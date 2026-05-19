import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ParserAdapter } from "@reforge/core";
import {
	snippet as coreSnippet,
	parse,
	print,
	semanticDiff,
} from "@reforge/core";
import { createQuery } from "@reforge/transform";
import { unifiedDiff } from "./diff.js";
import { resolveOptions } from "./options.js";
import { buildPlan, detectCycle } from "./plan.js";
import {
	createReportBuilder,
	type RecipeFileSummary,
	type RecipeReport,
} from "./report.js";
import type { RecipeContext, RecipeRef, Reporter } from "./types.js";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RunRecipesOptions {
	/** The recipes to run (and their precipes, resolved automatically). */
	recipes: RecipeRef[];

	/** Glob patterns for files to include. */
	include: string[];

	/** Glob patterns to exclude. node_modules is always excluded. */
	exclude?: string[];

	/**
	 * Resolve the adapter for a file. Return null to skip.
	 * Returning different adapters for .ts vs .css enables multi-language runs.
	 */
	adapterFor: (filePath: string) => ParserAdapter<any> | null;

	/** Preview without writing files. */
	dryRun?: boolean;

	/** Parallel workers. Default: 8. */
	concurrency?: number;

	/** Called after each file is processed. */
	onFile?: (summary: RecipeFileSummary) => void;

	/** Called on unrecoverable errors. Default: log and continue. */
	onError?: (filePath: string, error: unknown) => void;
}

export async function runRecipes(
	opts: RunRecipesOptions,
): Promise<RecipeReport> {
	const {
		recipes,
		include,
		exclude = [],
		adapterFor,
		dryRun = false,
		concurrency = 8,
		onFile,
		onError,
	} = opts;

	// ── Validate + build execution plan ────────────────────────────────────────
	const cycle = detectCycle(recipes);
	if (cycle) throw new Error(`Recipe dependency cycle detected: ${cycle}`);

	const plan = buildPlan(recipes);
	if (plan.length === 0) throw new Error("No recipes to run");

	const startTime = Date.now();
	const builder = createReportBuilder();
	const skipped = 0;
	let errored = 0;

	// ── Collect files ──────────────────────────────────────────────────────────
	const filePaths = await collectFiles(include, [
		"**/node_modules/**",
		"**/.git/**",
		...exclude,
	]);

	// ── Process files with bounded concurrency ─────────────────────────────────
	const tasks = filePaths.map((filePath) => async () => {
		let source: string;
		try {
			source = await readFile(filePath, "utf8");
		} catch (err) {
			errored++;
			onError ? onError(filePath, err) : defaultOnError(filePath, err);
			return;
		}

		let summary: RecipeFileSummary;
		try {
			summary = await processFile(filePath, source, plan, adapterFor);
		} catch (err) {
			errored++;
			onError ? onError(filePath, err) : defaultOnError(filePath, err);
			return;
		}

		// Write if changed
		if (summary.changed && !dryRun) {
			try {
				const newSource =
					(summary as { __newSource?: string }).__newSource ?? source;
				await writeFile(filePath, newSource, "utf8");
			} catch (err) {
				errored++;
				onError ? onError(filePath, err) : defaultOnError(filePath, err);
				return;
			}
		}

		// Accumulate into report
		builder.addFile(summary);
		for (const c of summary.changes) builder.addChange(c);
		for (const w of summary.warnings) builder.addWarning(w);
		for (const n of summary.needsReview) builder.addNeedsReview(n);

		onFile?.(summary);
	});

	await pool(tasks, concurrency);

	return builder.build({
		totalFiles: filePaths.length,
		skippedFiles: skipped,
		erroredFiles: errored,
		durationMs: Date.now() - startTime,
	});
}

// ─── Per-file processing ──────────────────────────────────────────────────────

async function processFile(
	filePath: string,
	source: string,
	plan: ReturnType<typeof buildPlan>,
	adapterFor: (fp: string) => ParserAdapter<any> | null,
): Promise<RecipeFileSummary & { __newSource?: string }> {
	const adapter = adapterFor(filePath);
	if (!adapter) {
		return {
			filePath,
			changed: false,
			diff: "",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [],
		};
	}

	// ONE parse for the whole file — all recipes share the same ParseResult
	const result = parse(source, { adapter });
	const query = createQuery(result);

	const fileChanges: RecipeFileSummary["changes"] = [];
	const fileWarnings: RecipeFileSummary["warnings"] = [];
	const fileNeedsReview: RecipeFileSummary["needsReview"] = [];

	for (const { recipe, options: boundOpts } of plan) {
		// ── Applicability check ──────────────────────────────────────────────────
		if (recipe.appliesTo) {
			const applies = await recipe.appliesTo({ source, filePath });
			if (!applies) continue;
		}

		// ── Resolve options ──────────────────────────────────────────────────────
		const resolvedOptions = resolveOptions(
			recipe.options,
			boundOpts,
			recipe.name,
		);

		// ── Build reporter ───────────────────────────────────────────────────────
		const report: Reporter = {
			change(description) {
				fileChanges.push({ filePath, recipeName: recipe.name, description });
			},
			warn(message) {
				fileWarnings.push({ filePath, recipeName: recipe.name, message });
			},
			needsReview(reason) {
				fileNeedsReview.push({ filePath, recipeName: recipe.name, reason });
			},
		};

		// ── Run the recipe ───────────────────────────────────────────────────────
		const ctx: RecipeContext<any> = {
			source,
			filePath,
			options: resolvedOptions,
			query,
			snippet: (s) => coreSnippet(s, { adapter }),
			report,
		};

		const result_ = await recipe.run(ctx);

		// Shorthand result — string or string[] convenience return
		if (typeof result_ === "string") {
			fileChanges.push({
				filePath,
				recipeName: recipe.name,
				description: result_,
			});
		} else if (Array.isArray(result_)) {
			for (const desc of result_) {
				fileChanges.push({
					filePath,
					recipeName: recipe.name,
					description: desc,
				});
			}
		}
	}

	// ONE print — format-preserving output with all mutations applied
	const { code: newSource } = print(result);
	const changed = newSource !== source;
	const diff = changed
		? unifiedDiff(source, newSource, { fromFile: filePath, toFile: filePath })
		: "";

	// Compute semantic changes — what CONCEPTS changed, not just lines
	const extractDecls = (
		adapter as {
			extractDeclarations?: (
				ast: any,
				src: string,
			) => import("@reforge/core").Declaration[];
		}
	).extractDeclarations;
	const semanticChanges: import("@reforge/core").SemanticChange[] = changed
		? (() => {
				if (!extractDecls) return [];
				try {
					const afterResult = parse(newSource, { adapter });
					return semanticDiff(source, newSource, {
						extractDeclarations: (ast: any, src: string) =>
							extractDecls(ast, src),
						beforeAst: result.ast,
						afterAst: afterResult.ast,
					});
				} catch {
					return [];
				}
			})()
		: [];

	const summary: RecipeFileSummary & { __newSource?: string } = {
		filePath,
		changed,
		diff,
		changes: fileChanges,
		warnings: fileWarnings,
		needsReview: fileNeedsReview,
		semanticChanges,
	};

	if (changed) {
		summary.__newSource = newSource;
	}

	return summary;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────

async function pool<T>(
	tasks: Array<() => Promise<T>>,
	concurrency: number,
): Promise<void> {
	let i = 0;
	async function worker() {
		while (i < tasks.length) {
			const task = tasks[i];
			if (!task) break;
			i++;
			await task();
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, tasks.length) }, worker),
	);
}

// ─── File collection ──────────────────────────────────────────────────────────

async function collectFiles(
	include: string[],
	exclude: string[],
): Promise<string[]> {
	const paths: string[] = [];
	const always = ["**/node_modules/**", "**/.git/**", ...exclude];
	const { stat } = await import("node:fs/promises");

	for (const pattern of include) {
		const isAbsolute =
			pattern.startsWith("/") ||
			pattern.startsWith(".\\") ||
			/^[a-zA-Z]:/.test(pattern);
		const hasGlobChars = /[*?[{]/.test(pattern);

		if (isAbsolute && !hasGlobChars) {
			try {
				await stat(pattern);
				paths.push(resolve(pattern));
			} catch {
				// File doesn't exist — skip silently
			}
			continue;
		}

		const { Glob } = await import("bun");
		try {
			const g = new Glob(pattern);
			let baseDir: string;
			if (isAbsolute) {
				baseDir = pattern.replace(/\/[^/*?[{]*$/, "") || "/";
			} else {
				baseDir = ".";
			}
			const results = Array.from(await g.scanSync(baseDir));
			for (const entry of results) {
				const fullPath = resolve(baseDir, entry);
				if (!always.some((ex) => minimatch(fullPath, ex))) {
					paths.push(fullPath);
				}
			}
		} catch {
			throw new Error(`@reforge/recipes failed to glob pattern: "${pattern}"`);
		}
	}
	return [...new Set(paths)];
}

function minimatch(path: string, pattern: string): boolean {
	const re = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "(.+)")
		.replace(/\*/g, "([^/]+)");
	return new RegExp(`^${re}$`).test(path);
}

function defaultOnError(filePath: string, error: unknown): void {
	console.error(`[reforge/recipes] Error processing ${filePath}:`, error);
}
