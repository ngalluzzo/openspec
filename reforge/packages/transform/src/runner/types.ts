import type { ParserAdapter } from "@reforge/core";
import type { QueryBuilder } from "../query.js";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface CodemodOptions<TNode extends object> {
	/**
	 * Glob patterns for files to include.
	 * @example ["src/**\/*.ts", "src/**\/*.css"]
	 */
	include: string[];

	/**
	 * Glob patterns to exclude. node_modules is always excluded.
	 * @example ["**\/*.test.ts", "dist/**"]
	 */
	exclude?: string[];

	/**
	 * Resolve the adapter for a given file path.
	 * Returning null silently skips the file.
	 *
	 * @example
	 * adapterFor: (filePath) => filePath.endsWith(".css") ? cssAdapter : tsAdapter
	 */
	adapterFor: (filePath: string) => ParserAdapter<TNode> | null;

	/**
	 * The transform function. Called once per file.
	 * Mutate via the query object — do not return anything.
	 *
	 * The function may be async (e.g. for adapter-level scope lookups).
	 */
	transform: (ctx: TransformContext<TNode>) => void | Promise<void>;

	/**
	 * Max number of files processed concurrently.
	 * @default 8
	 */
	concurrency?: number;

	/**
	 * If true, no files are written. Results still flow through onResult.
	 * @default false
	 */
	dryRun?: boolean;

	/**
	 * Called after each file is processed (whether changed or not).
	 */
	onResult?: (result: FileResult) => void;

	/**
	 * Called if a file throws during transform. Default: log and continue.
	 */
	onError?: (err: FileError) => void;
}

// ─── Transform context ────────────────────────────────────────────────────────

export interface TransformContext<TNode extends object> {
	/** The file's source string. */
	source: string;
	/** Absolute path to the file. */
	filePath: string;
	/** The adapter resolved for this file. */
	adapter: ParserAdapter<TNode>;
	/** Query builder — the primary way to find and mutate nodes. */
	query: QueryBuilder<TNode>;
	/**
	 * Parse a snippet into a node for insertion.
	 * Sugar for the core snippet() function bound to this file's adapter.
	 */
	snippet: (source: string) => TNode;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export type FileResult = FileChanged | FileUnchanged | FileSkipped;

export interface FileChanged {
	kind: "changed";
	filePath: string;
	/** The new source after transformation. */
	output: string;
	/** Unified diff string (always present, even in dryRun). */
	diff: string;
}

export interface FileUnchanged {
	kind: "unchanged";
	filePath: string;
}

export interface FileSkipped {
	kind: "skipped";
	filePath: string;
	/** Reason the file was skipped (no adapter, binary file, etc.). */
	reason: string;
}

export interface FileError {
	filePath: string;
	error: unknown;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface CodemodSummary {
	total: number;
	changed: number;
	unchanged: number;
	skipped: number;
	errored: number;
	/** Total wall-clock time in ms. */
	durationMs: number;
}
