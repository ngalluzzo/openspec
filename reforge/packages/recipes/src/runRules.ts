import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "@reforge/core";
import { createQuery } from "@reforge/transform";
import type { ParserAdapter } from "@reforge/core";
import type { Rule, ResolvedDiagnostic, LintDiagnostic } from "./types.js";
import { resolveOptions } from "./options.js";
import { runRecipes } from "./run.js";
import type { RecipeReport } from "./report.js";

// ─── Options ──────────────────────────────────────────────────────────────────

export interface RunRulesOptions {
	/** Rules to run. Use rule.as('error') to override severity at the call site. */
	rules: Rule<any>[];

	/** Glob patterns for files to check. */
	include: string[];

	/** Glob patterns to exclude. node_modules is always excluded. */
	exclude?: string[];

	/** Resolve the adapter for a file. Return null to skip. */
	adapterFor: (filePath: string) => ParserAdapter<any> | null;

	/**
	 * Run fix recipes for rules that have them.
	 * Default false — lint only.
	 * When true, acts like runRecipes() on the fix recipes.
	 */
	fix?: boolean;

	/** Parallel workers. Default: 8. */
	concurrency?: number;

	/** Called after each file is checked. */
	onFile?: (filePath: string, diagnostics: ResolvedDiagnostic[]) => void;

	/** Called on errors. */
	onError?: (filePath: string, error: unknown) => void;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface RunRulesResult {
	/** All diagnostics, sorted by file then line. */
	diagnostics: ResolvedDiagnostic[];

	/** Diagnostics with severity="error". */
	errors: ResolvedDiagnostic[];

	/** Diagnostics with severity="warning". */
	warnings: ResolvedDiagnostic[];

	/** Diagnostics with severity="info". */
	info: ResolvedDiagnostic[];

	/** Summary counts. */
	summary: {
		totalFiles: number;
		filesWithIssues: number;
		errorCount: number;
		warningCount: number;
		infoCount: number;
		durationMs: number;
	};

	/**
	 * If fix: true was passed, the recipe report from the fix phase.
	 * Undefined when fix: false.
	 */
	fixReport?: RecipeReport;

	/**
	 * Format as ESLint-compatible JSON output.
	 * Suitable for editor integrations that consume ESLint's output format.
	 */
	toEslintJson(): string;

	/**
	 * Format as a human-readable summary.
	 * Suitable for CI output and CLI display.
	 */
	toSummary(): string;
}

// ─── runRules ─────────────────────────────────────────────────────────────────

export async function runRules(opts: RunRulesOptions): Promise<RunRulesResult> {
	const {
		rules,
		include,
		exclude = [],
		adapterFor,
		fix = false,
		concurrency = 8,
		onFile,
		onError,
	} = opts;

	const startTime = Date.now();
	const allDiagnostics: ResolvedDiagnostic[] = [];

	// Collect files using the same glob logic as runRecipes
	const filePaths = await collectFiles(include, exclude ?? []);

	// Process files with bounded concurrency
	const tasks = filePaths.map((filePath) => async () => {
		const adapter = adapterFor(filePath);
		if (!adapter) return;

		let source: string;
		try {
			source = await readFile(filePath, "utf8");
		} catch (err) {
			onError?.(filePath, err);
			return;
		}

		let fileDiagnostics: ResolvedDiagnostic[];
		try {
			fileDiagnostics = await lintFile(filePath, source, rules, adapter);
		} catch (err) {
			onError?.(filePath, err);
			return;
		}

		allDiagnostics.push(...fileDiagnostics);
		onFile?.(filePath, fileDiagnostics);
	});

	await pool(tasks, concurrency);

	// Sort: file path, then line, then column
	allDiagnostics.sort((a, b) =>
		a.filePath !== b.filePath
			? a.filePath.localeCompare(b.filePath)
			: a.line !== b.line
				? a.line - b.line
				: a.column - b.column,
	);

	const errors = allDiagnostics.filter((d) => d.severity === "error");
	const warnings = allDiagnostics.filter((d) => d.severity === "warning");
	const info = allDiagnostics.filter((d) => d.severity === "info");

	const filesWithIssues = new Set(allDiagnostics.map((d) => d.filePath)).size;

	// ── Fix phase ──────────────────────────────────────────────────────────────
	let fixReport: RecipeReport | undefined;
	if (fix) {
		const fixableRules = rules.filter((r) => r.fix);
		if (fixableRules.length > 0) {
			fixReport = await runRecipes({
				recipes: fixableRules.map((r) => r.fix!),
				include,
				exclude: exclude ?? [],
				adapterFor,
				concurrency: concurrency ?? 8,
				onError: onError ?? (() => {}),
			});
		}
	}

	const durationMs = Date.now() - startTime;

	const result: RunRulesResult = {
		diagnostics: allDiagnostics,
		errors,
		warnings,
		info,
		summary: {
			totalFiles: filePaths.length,
			filesWithIssues,
			errorCount: errors.length,
			warningCount: warnings.length,
			infoCount: info.length,
			durationMs,
		},
		toEslintJson() {
			return formatEslintJson(allDiagnostics, filePaths);
		},
		toSummary() {
			return formatSummary(allDiagnostics, durationMs, filePaths.length);
		},
	};

	if (fixReport) {
		result.fixReport = fixReport;
	}

	return result;
}

// ─── Per-file lint ────────────────────────────────────────────────────────────

async function lintFile(
	filePath: string,
	source: string,
	rules: Rule<any>[],
	adapter: ParserAdapter<any>,
): Promise<ResolvedDiagnostic[]> {
	const resolved: ResolvedDiagnostic[] = [];

	// ONE parse per file — all rules share the same ParseResult
	const result = parse(source, { adapter });
	const query = createQuery(result);

	for (const rule of rules) {
		// Applicability check
		if (rule.appliesTo) {
			const applies = await rule.appliesTo({ source, filePath });
			if (!applies) continue;
		}

		// Resolve options
		const options = resolveOptions(rule.options, {}, rule.name);

		// Build a minimal context for lint() — read-only, no report needed
		const ctx = {
			source,
			filePath,
			options,
			query,
			snippet: () => {
				throw new Error(
					"snippet() is not available in lint() — use fix recipe instead",
				);
			},
			report: {
				change: () => {},
				warn: () => {},
				needsReview: () => {},
			},
		};

		// Run lint()
		let diagnostics: LintDiagnostic[];
		try {
			diagnostics = await rule.lint(ctx);
		} catch (err) {
			console.error(
				`[reforge/rules] Rule "${rule.name}" threw during lint of ${filePath}:`,
				err,
			);
			continue;
		}

		// Resolve each diagnostic to a concrete location
		for (const d of diagnostics) {
			const sev = d.severity ?? rule.severity;
			const loc = d.path ? getLocation(d.path) : { line: 1, column: 1 };
			const fixable = !!(rule.fix ?? d.fix);

			resolved.push({
				ruleId: rule.name,
				ruleName: rule.displayName,
				severity: sev,
				message: d.message,
				filePath,
				line: loc.line,
				column: loc.column,
				fixable,
			});
		}
	}

	return resolved;
}

function getLocation(path: any): { line: number; column: number } {
	try {
		const loc = path._originalMap?.originalLocation(path.node);
		if (loc) return { line: loc.start.line, column: loc.start.column + 1 };
	} catch {}
	return { line: 1, column: 1 };
}

// ─── Output formatters ────────────────────────────────────────────────────────

function formatEslintJson(
	diagnostics: ResolvedDiagnostic[],
	filePaths: string[],
): string {
	// ESLint JSON format: array of file results
	const byFile = new Map<string, ResolvedDiagnostic[]>();
	for (const fp of filePaths) byFile.set(fp, []);
	for (const d of diagnostics) {
		const arr = byFile.get(d.filePath) ?? [];
		arr.push(d);
		byFile.set(d.filePath, arr);
	}

	const results = [...byFile.entries()].map(([filePath, fileDiags]) => ({
		filePath,
		messages: fileDiags.map((d) => ({
			ruleId: d.ruleId,
			severity: d.severity === "error" ? 2 : d.severity === "warning" ? 1 : 0,
			message: d.message,
			line: d.line,
			column: d.column,
			fixable: d.fixable,
		})),
		errorCount: fileDiags.filter((d) => d.severity === "error").length,
		warningCount: fileDiags.filter((d) => d.severity === "warning").length,
	}));

	return JSON.stringify(results, null, 2);
}

function formatSummary(
	diagnostics: ResolvedDiagnostic[],
	durationMs: number,
	totalFiles: number,
): string {
	if (diagnostics.length === 0) {
		return `✓ No issues found in ${totalFiles} file${totalFiles === 1 ? "" : "s"}`;
	}

	const lines: string[] = [];
	let lastFile = "";

	for (const d of diagnostics) {
		if (d.filePath !== lastFile) {
			lines.push(`\n${d.filePath}`);
			lastFile = d.filePath;
		}
		const sev =
			d.severity === "error"
				? "error"
				: d.severity === "warning"
					? "warn "
					: "info ";
		const fix = d.fixable ? " [fixable]" : "";
		const loc = `${d.line}:${String(d.column).padEnd(4)}`;
		lines.push(`  ${sev}  ${loc}  ${d.message}${fix}  ${d.ruleId}`);
	}

	const errors = diagnostics.filter((d) => d.severity === "error").length;
	const warnings = diagnostics.filter((d) => d.severity === "warning").length;
	const dur =
		durationMs < 1000
			? `${durationMs}ms`
			: `${(durationMs / 1000).toFixed(1)}s`;

	lines.push(
		`\n${errors + warnings} problem${errors + warnings === 1 ? "" : "s"} ` +
			`(${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}) — ${dur}`,
	);

	if (diagnostics.some((d) => d.fixable)) {
		lines.push(
			`Run with --fix to apply ${diagnostics.filter((d) => d.fixable).length} fixable change${diagnostics.filter((d) => d.fixable).length === 1 ? "" : "s"}`,
		);
	}

	return lines.join("\n");
}

// ─── Concurrency + glob ───────────────────────────────────────────────────────

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

async function collectFiles(
	include: string[],
	exclude: string[],
): Promise<string[]> {
	const paths: string[] = [];
	const _always = ["**/node_modules/**", "**/.git/**", ...exclude];
	const { stat } = await import("node:fs/promises");

	for (const pattern of include) {
		// If the pattern is an absolute literal file path (no glob characters),
		// check it exists and add it directly. This handles tests that pass
		// absolute file paths (e.g., /tmp/xxx/file.fake) which glob engines
		// don't match as patterns.
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

		// Otherwise use bun's Glob for pattern matching
		const { Glob } = await import("bun");
		try {
			const g = new Glob(pattern);
			// Determine the base directory to scan from
			let baseDir: string;
			if (isAbsolute) {
				// Pattern like "/some/dir/*.fake" — scan from the directory portion
				baseDir = pattern.replace(/\/[^/*?[{]*$/, "") || "/";
			} else {
				baseDir = ".";
			}
			const results = Array.from(await g.scanSync(baseDir));
			for (const entry of results) {
				const fullPath = resolve(baseDir, entry);
				paths.push(fullPath);
			}
		} catch {
			throw new Error(`@reforge/recipes failed to glob pattern: "${pattern}"`);
		}
	}
	return [...new Set(paths)];
}

function _minimatch(path: string, pattern: string): boolean {
	const re = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "(.+)")
		.replace(/\*/g, "([^/]+)");
	return new RegExp(`^${re}$`).test(path);
}
