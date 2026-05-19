// ─── JSDoc Conventions ──────────────────────────────────────────────────────
//
// All public types and functions in @reforge use JSDoc with the following
// conventions. Internal/private members follow the same style for consistency.
//
// Module-level docs:
//   One block comment at the top of each file explaining what the module does,
//   its key concepts, and any design principles. No @file tag — the module
//   description is implied by the comment block.
//
// Types (interfaces, type aliases):
//   One-line summary describing what the type represents. Add @example when
//   the type's purpose isn't self-evident from its name and shape.
//
// Functions:
//   One-line summary (imperative mood). @param for non-obvious parameters.
//   @returns when the return value isn't obvious. @example for non-trivial APIs.
//
// Classes:
//   Summary of what the class does and its role in the system. @example for
//   usage when the API isn't trivially clear.
//
// Tone: Direct, imperative, no fluff. "Walk up the ancestor chain" not
//   "This method is used to walk up..."
//
// Cross-references: Use @see for related types/functions within the same
//   package. Avoid absolute paths — rely on TypeDoc's link resolution.
//
// ─── Source location ────────────────────────────────────────────────────────

export interface Position {
	/** 0-based byte offset into the source string */
	offset: number;
	/** 1-based line number */
	line: number;
	/** 0-based column */
	column: number;
}

export interface SourceLocation {
	start: Position;
	end: Position;
}

// ─── Visitor ────────────────────────────────────────────────────────────────

export type VisitControl = "skip" | "stop" | undefined;

export interface NodeVisitor<TNode extends object> {
	enter?(node: TNode, parent: TNode | null, key: string | null): VisitControl;
	leave?(node: TNode, parent: TNode | null, key: string | null): void;
}

// ─── Parser adapter ─────────────────────────────────────────────────────────

/**
 * The only contract @reforge/core requires from any parser.
 *
 * Five methods + a language tag. Nothing else. The adapter is responsible
 * for all language-specific knowledge — core stays completely generic.
 */
export interface ParserAdapter<TNode extends object> {
	/** Human-readable language identifier. e.g. "typescript", "css", "graphql" */
	readonly language: string;

	/** Parse a full source file into a root AST node. */
	parse(source: string, options?: unknown): TNode;

	/**
	 * Parse a source snippet into a single node.
	 * Used by parse.snippet() — the idiomatic way to build new nodes
	 * without needing a full pretty-printer.
	 */
	parseSnippet(source: string, options?: unknown): TNode;

	/** Walk every node depth-first, calling visitor hooks. */
	walk(root: TNode, visitor: NodeVisitor<TNode>): void;

	/**
	 * Return the source location of a node.
	 * This is what connects nodes to the original source in the shadow-copy.
	 */
	locate(node: TNode): SourceLocation | null;

	/** Return the canonical type name of a node. e.g. "FunctionDeclaration" */
	typeOf(node: TNode): string;

	/**
	 * Optional: extract comments from the gap text preceding a node.
	 * If absent, reforge uses the generic gap comment parser which handles
	 * syntax for all C-like languages.
	 * Adapters with richer comment models (e.g. JSDoc-aware TS adapter)
	 * should implement this for more precise comment attribution.
	 */
	extractComments?(
		gapText: string,
		node: TNode,
		source: string,
	): import("./comments.js").CommentInfo[];

	/**
	 * Optional: pretty-print a node to a string.
	 * Required only when inserting programmatically-built nodes
	 * (not snippets). If absent, built-node insertion throws a
	 * helpful error directing users to parse.snippet() instead.
	 */
	print?(node: TNode, options?: PrintOptions): string;
}

// ─── Print options ───────────────────────────────────────────────────────────

export interface PrintOptions {
	tabWidth?: number;
	useTabs?: boolean;
	/** Name of the source file — used in source map output */
	sourceFileName?: string;
	/** Name to give the output map */
	sourceMapName?: string;
}

// ─── Parse result ────────────────────────────────────────────────────────────

export interface ParseResult<TNode extends object> {
	/** The mutable AST root. Go wild — mutate anything. */
	ast: TNode;
	/** The sealed shadow-copy index. Do not touch directly. */
	readonly originalMap: OriginalSourceMap<TNode>;
	/** The adapter that produced this result. */
	readonly adapter: ParserAdapter<TNode>;
	/** The original source string. */
	readonly source: string;
	/** Gap override map — blank line control. Set via path.setBlankLinesBefore/After(). */
	readonly gapOverrides: import("./gaps.js").GapOverrideMap<TNode>;
	/**
	 * Nodes that have a gap override registered.
	 * The printer uses this to decide whether to descend into an unmodified
	 * subtree — if no descendant has an override, the subtree can be emitted
	 * as a single verbatim slice (the fast path).
	 */
	readonly overrideTargets: Set<TNode>;
}

// ─── Print result ────────────────────────────────────────────────────────────

export interface PrintResult {
	/** The reprinted source code. */
	code: string;
	/** Full v3 source map with named identifier mappings. */
	map: SourceMapV3;
}

// ─── Source map (v3) ─────────────────────────────────────────────────────────

export interface SourceMapV3 {
	version: 3;
	sources: string[];
	sourcesContent: (string | null)[];
	names: string[];
	mappings: string;
	file?: string;
}

// ─── Shadow-copy ─────────────────────────────────────────────────────────────

/**
 * Stores the original source slice and location for every parsed node.
 * Keyed by node object identity (WeakMap) — no .original pollution on AST nodes.
 */
export interface OriginalSourceMap<TNode extends object> {
	/** Returns the original source slice for a node, or null if node is new. */
	originalSlice(node: TNode): string | null;

	/** Returns the original source location, or null if node is new. */
	originalLocation(node: TNode): SourceLocation | null;

	/**
	 * Deep structural comparison: has anything about this node changed
	 * since it was parsed? Uses the adapter's typeOf + locate to compare.
	 */
	isModified(node: TNode): boolean;

	/** Mark a node as newly constructed (no original source). */
	markNew(node: TNode): void;
}
