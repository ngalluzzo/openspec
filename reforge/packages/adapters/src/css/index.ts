import type { NodeVisitor, ParserAdapter, SourceLocation } from "@reforge/core";

// PostCSS is a peer dependency — never bundled.
import type { Node as PostCSSNode, Root } from "postcss";

let postcss: typeof import("postcss");

function requirePostcss(): typeof import("postcss") {
	if (postcss) return postcss;
	try {
		postcss = require("postcss");
		return postcss;
	} catch {
		throw new Error(
			`@reforge/adapters/css requires "postcss" as a peer dependency.\n` +
				`Install it: npm install postcss`,
		);
	}
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

/**
 * CSS/SCSS adapter backed by PostCSS.
 *
 * Demonstrates that @reforge/core's ParserAdapter contract is truly
 * language-agnostic — the same shadow-copy engine that handles TypeScript
 * ASTs works identically over PostCSS node trees.
 */
export const cssAdapter: ParserAdapter<PostCSSNode> = {
	language: "css",

	parse(source: string): PostCSSNode {
		const pc = requirePostcss();
		// postcss.parse returns a Root node with source locations
		return pc.parse(source);
	},

	parseSnippet(source: string): PostCSSNode {
		const pc = requirePostcss();
		// For snippets we also return the Root — callers pick what they need
		return pc.parse(source);
	},

	walk(root: PostCSSNode, visitor: NodeVisitor<PostCSSNode>): void {
		function visit(
			node: PostCSSNode,
			parent: PostCSSNode | null,
			key: string | null,
		): boolean {
			const control = visitor.enter?.(node, parent, key);
			if (control === "stop") return true;

			if (control !== "skip" && "nodes" in node && Array.isArray(node.nodes)) {
				for (const child of node.nodes as PostCSSNode[]) {
					if (visit(child, node, "nodes")) return true;
				}
			}

			visitor.leave?.(node, parent, key);
			return false;
		}

		visit(root, null, null);
	},

	locate(node: PostCSSNode): SourceLocation | null {
		const source = node.source;
		if (!source?.start || !source?.end) return null;

		// PostCSS provides line/column but not byte offsets directly.
		// We reconstruct offsets from the source file stored on the root.
		const root = node.root();
		const rawSource = (root as Root).source?.input?.css ?? "";

		const startOffset = positionToOffset(
			rawSource,
			source.start.line,
			source.start.column,
		);
		const endOffset = positionToOffset(
			rawSource,
			source.end.line,
			source.end.column + 1,
		);

		return {
			start: {
				offset: startOffset,
				line: source.start.line, // PostCSS is 1-based — matches reforge
				column: source.start.column - 1, // PostCSS columns are 1-based; reforge is 0-based
			},
			end: {
				offset: endOffset,
				line: source.end.line,
				column: source.end.column, // end column kept as-is for slice accuracy
			},
		};
	},

	typeOf(node: PostCSSNode): string {
		// PostCSS node types: "root", "rule", "atrule", "decl", "comment"
		return node.type;
	},

	/**
	 * Optional printer — PostCSS can stringify its own nodes.
	 * Having this means users can also insert programmatically-built nodes,
	 * not just snippets.
	 */
	print(node: PostCSSNode): string {
		requirePostcss();
		return node.toString();
	},
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Convert a 1-based line + 1-based column to a 0-based byte offset.
 * Used to reconstruct offsets from PostCSS's line/col positions.
 */
function positionToOffset(
	source: string,
	line: number,
	column: number,
): number {
	let offset = 0;
	let currentLine = 1;

	for (let i = 0; i < source.length; i++) {
		if (currentLine === line && i - offset === column - 1) {
			return i;
		}
		if (source[i] === "\n") {
			currentLine++;
			if (currentLine > line) return i;
			offset = i + 1;
		}
	}

	return source.length;
}
