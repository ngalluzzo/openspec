import { glob, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./pool.js";
import { processFile } from "./processFile.js";
import type {
	CodemodOptions,
	CodemodSummary,
	FileError,
	FileResult,
} from "./types.js";

export type {
	FileChanged,
	FileSkipped,
	FileUnchanged,
	TransformContext,
} from "./types.js";
export type { CodemodOptions, CodemodSummary, FileError, FileResult };

/**
 * Run a codemod over a set of files.
 *
 * @example
 * ```ts
 * import { codemod } from "@reforge/transform/runner";
 * import { tsAdapter } from "@reforge/adapters/typescript";
 *
 * const summary = await codemod({
 *   include: ["src/**\/*.ts"],
 *   adapterFor: () => tsAdapter,
 *   async transform({ query }) {
 *     query.find("ImportDeclaration[moduleSpecifier=lodash]")
 *          .mutate(p => { (p.node).moduleSpecifier = "lodash-es"; });
 *   },
 * });
 *
 * console.log(`Changed ${summary.changed} of ${summary.total} files`);
 * ```
 */
export async function codemod<TNode extends object>(
	options: CodemodOptions<TNode>,
): Promise<CodemodSummary> {
	const {
		include,
		exclude = [],
		concurrency = 8,
		dryRun = false,
		onResult,
		onError,
	} = options;

	const startTime = Date.now();

	// ── Collect file paths ──────────────────────────────────────────────────────
	const filePaths = await collectFiles(include, [
		"**/node_modules/**",
		"**/.git/**",
		...exclude,
	]);

	if (filePaths.length === 0) {
		return {
			total: 0,
			changed: 0,
			unchanged: 0,
			skipped: 0,
			errored: 0,
			durationMs: 0,
		};
	}

	// ── Build tasks ─────────────────────────────────────────────────────────────
	const summary = {
		total: filePaths.length,
		changed: 0,
		unchanged: 0,
		skipped: 0,
		errored: 0,
	};

	const tasks = filePaths.map((filePath) => async () => {
		let source: string;
		try {
			source = await readFile(filePath, "utf8");
		} catch (err) {
			const fileErr: FileError = { filePath, error: err };
			onError ? onError(fileErr) : defaultOnError(fileErr);
			summary.errored++;
			return;
		}

		let result: FileResult;
		try {
			result = await processFile(filePath, source, options);
		} catch (err) {
			const fileErr: FileError = { filePath, error: err };
			onError ? onError(fileErr) : defaultOnError(fileErr);
			summary.errored++;
			return;
		}

		// ── Write if changed and not dry-run ──────────────────────────────────────
		if (result.kind === "changed" && !dryRun) {
			try {
				await writeFile(filePath, result.output, "utf8");
			} catch (err) {
				const fileErr: FileError = { filePath, error: err };
				onError ? onError(fileErr) : defaultOnError(fileErr);
				summary.errored++;
				return;
			}
		}

		// ── Tally ─────────────────────────────────────────────────────────────────
		if (result.kind === "changed") summary.changed++;
		if (result.kind === "unchanged") summary.unchanged++;
		if (result.kind === "skipped") summary.skipped++;

		onResult?.(result);
	});

	await pool(tasks, concurrency);

	return { ...summary, durationMs: Date.now() - startTime };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function collectFiles(
	include: string[],
	exclude: string[],
): Promise<string[]> {
	const sets = await Promise.all(
		include.map(async (pattern) => {
			const paths: string[] = [];
			// Node 22+ has fs/promises glob. For earlier nodes we fall back gracefully.
			try {
				for await (const entry of glob(pattern, {
					exclude: (p) => exclude.some((ex) => minimatch(p, ex)),
				})) {
					paths.push(resolve(entry));
				}
			} catch {
				// glob not available in this Node version — surface a helpful error
				throw new Error(
					`@reforge/transform/runner requires Node 22+ for built-in glob support, ` +
						`or install the "glob" package as a dependency.\n` +
						`Pattern attempted: "${pattern}"`,
				);
			}
			return paths;
		}),
	);

	// Deduplicate across patterns
	return [...new Set(sets.flat())];
}

// Minimal glob-to-regex for exclude matching
function minimatch(path: string, pattern: string): boolean {
	const re = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*\*/g, "(.+)")
		.replace(/\*/g, "([^/]+)");
	return new RegExp(`^${re}$`).test(path);
}

function defaultOnError({ filePath, error }: FileError): void {
	console.error(`[reforge] Error processing ${filePath}:`, error);
}
