import type { NodeVisitor, ParserAdapter, SourceLocation } from "@reforge/core";

// yaml is a peer dependency — never bundled.
import type {
	Document,
	Pair,
	ParsedNode,
	Scalar,
	YAMLMap,
	YAMLSeq,
} from "yaml";

let yaml: typeof import("yaml");

function requireYaml(): typeof import("yaml") {
	if (yaml) return yaml;
	try {
		yaml = require("yaml");
		return yaml;
	} catch {
		throw new Error(
			`@reforge/adapters/yaml requires "yaml" as a peer dependency.\n` +
				`Install it: npm install yaml`,
		);
	}
}

// ─── Node union ───────────────────────────────────────────────────────────────

/**
 * All node types the YAML adapter may produce.
 * Pair is intentionally included — it is a first-class node for queries like
 * `find("Pair[key.value=kind]")`.
 */
export type YamlNode =
	| Document<ParsedNode>
	| YAMLMap<ParsedNode, ParsedNode | null>
	| YAMLSeq<ParsedNode | null>
	| Pair<ParsedNode, ParsedNode | null>
	| Scalar;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a 0-based byte offset to a 1-based line / 0-based column position.
 */
function offsetToLineCol(
	source: string,
	offset: number,
): { line: number; column: number } {
	const clamped = Math.min(offset, source.length);
	let line = 1;
	let lastNewline = -1;
	for (let i = 0; i < clamped; i++) {
		if (source[i] === "\n") {
			line++;
			lastNewline = i;
		}
	}
	return { line, column: clamped - lastNewline - 1 };
}

/**
 * Build a SourceLocation from a yaml node's range tuple.
 * Returns null for synthetic/new nodes that have no range.
 */
function rangeToLocation(
	source: string,
	range: [number, number, number] | undefined,
): SourceLocation | null {
	if (!range) return null;
	const [startOffset, , endOffset] = range;
	if (
		typeof startOffset !== "number" ||
		typeof endOffset !== "number" ||
		startOffset < 0 ||
		endOffset < startOffset
	) {
		return null;
	}
	const start = offsetToLineCol(source, startOffset);
	const end = offsetToLineCol(source, endOffset);
	return {
		start: { offset: startOffset, ...start },
		end: { offset: endOffset, ...end },
	};
}

/**
 * Compute a Pair's range from its key/value children when the Pair itself
 * carries no range (which can happen in hand-constructed trees).
 */
function pairRange(
	pair: Pair,
): [number, number, number] | undefined {
	const key = pair.key as { range?: [number, number, number] } | null;
	const val = pair.value as { range?: [number, number, number] } | null;
	const start = key?.range?.[0] ?? val?.range?.[0];
	const end = val?.range?.[2] ?? key?.range?.[2];
	if (start === undefined || end === undefined) return undefined;
	return [start, end, end];
}

/**
 * Resolve a dot-path starting from the second segment onward using plain
 * property access. Used as the fallback after a map-key lookup.
 */
function resolveRemainingPath(value: unknown, path: string[]): unknown {
	let current = value;
	for (const key of path) {
		if (current === null || current === undefined || typeof current !== "object")
			return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a YAML parser adapter for reforge.
 *
 * The adapter is stateful — it closes over the source string set during
 * `parse()` so that `locate()` can convert byte offsets to line/column.
 * For concurrent file processing, call `createYamlAdapter()` per file:
 *
 * ```ts
 * const summary = await codemod({
 *   include: ["**\/*.yml"],
 *   adapterFor: () => createYamlAdapter(),
 *   async transform({ query }) { ... },
 * });
 * ```
 *
 * For single-file scripts the exported `yamlAdapter` singleton is fine.
 */
export function createYamlAdapter(): ParserAdapter<YamlNode> {
	const { isDocument, isMap, isSeq, isPair, isScalar, parseDocument, stringify } =
		requireYaml();

	let _source = "";

	// ── typeOf ────────────────────────────────────────────────────────────────

	function typeOf(node: YamlNode): string {
		if (isDocument(node)) return "Document";
		if (isMap(node)) return "Map";
		if (isSeq(node)) return "Seq";
		if (isPair(node)) return "Pair";
		if (isScalar(node)) return "Scalar";
		return "Unknown";
	}

	// ── walk ──────────────────────────────────────────────────────────────────

	function visitNode(
		node: YamlNode,
		parent: YamlNode | null,
		key: string | null,
		visitor: NodeVisitor<YamlNode>,
	): boolean {
		const ctrl = visitor.enter?.(node, parent, key);
		if (ctrl === "stop") return true;

		if (ctrl !== "skip") {
			if (isDocument(node)) {
				if (node.contents) {
					if (visitNode(node.contents as YamlNode, node, "contents", visitor))
						return true;
				}
			} else if (isMap(node) || isSeq(node)) {
				for (const item of node.items) {
					if (item && visitNode(item as YamlNode, node, "items", visitor))
						return true;
				}
			} else if (isPair(node)) {
				if (node.key) {
					if (visitNode(node.key as YamlNode, node, "key", visitor))
						return true;
				}
				if (node.value) {
					if (visitNode(node.value as YamlNode, node, "value", visitor))
						return true;
				}
			}
			// Scalar — no children
		}

		visitor.leave?.(node, parent, key);
		return false;
	}

	// ── locate ────────────────────────────────────────────────────────────────

	function locate(node: YamlNode): SourceLocation | null {
		if (isPair(node)) {
			const explicit = (node as unknown as { range?: [number, number, number] })
				.range;
			return rangeToLocation(_source, explicit ?? pairRange(node));
		}
		const withRange = node as unknown as { range?: [number, number, number] };
		return rangeToLocation(_source, withRange.range);
	}

	// ── getAttribute ──────────────────────────────────────────────────────────

	function getAttribute(node: YamlNode, path: string[]): unknown {
		if (path.length === 0) return undefined;
		const [first, ...rest] = path as [string, ...string[]];

		if (isMap(node)) {
			// Look up the map entry whose key matches the first path segment
			const pair = node.items.find(
				(p) => isScalar(p.key) && String(p.key.value) === first,
			);
			if (!pair) return undefined;
			const val = isScalar(pair.value) ? pair.value.value : pair.value;
			return rest.length === 0 ? val : resolveRemainingPath(val, rest);
		}

		if (isPair(node)) {
			if (first === "key") {
				const keyVal = isScalar(node.key) ? node.key.value : undefined;
				return rest.length === 0 ? keyVal : resolveRemainingPath(keyVal, rest);
			}
			if (first === "value") {
				const valNode = node.value;
				const valVal = isScalar(valNode) ? valNode?.value : valNode;
				return rest.length === 0 ? valVal : resolveRemainingPath(valVal, rest);
			}
		}

		if (isScalar(node)) {
			if (first === "value" && rest.length === 0) return node.value;
		}

		// Fall back to direct property access for Document and unknown nodes
		const direct = (node as Record<string, unknown>)[first];
		return rest.length === 0 ? direct : resolveRemainingPath(direct, rest);
	}

	// ── print ─────────────────────────────────────────────────────────────────

	/**
	 * Stringify a node fragment for insertion.
	 *
	 * @param options.indent - Spaces per indent level (default 2).
	 * @param options.baseIndent - String to prepend to every line except the first.
	 *   Use this when inserting into an already-indented context.
	 */
	function print(
		node: YamlNode,
		options?: { indent?: number; baseIndent?: string },
	): string {
		const indentSize = options?.indent ?? 2;
		const raw = stringify(node, { indent: indentSize }).trimEnd();
		if (!options?.baseIndent) return raw;
		// Prepend baseIndent to every line after the first
		return raw
			.split("\n")
			.map((line, i) => (i === 0 ? line : options.baseIndent + line))
			.join("\n");
	}

	// ── adapter ───────────────────────────────────────────────────────────────

	return {
		language: "yaml",

		parse(source: string): YamlNode {
			_source = source;
			return parseDocument(source) as unknown as YamlNode;
		},

		parseSnippet(source: string): YamlNode {
			_source = source;
			const doc = parseDocument(source);
			// Return the root contents node rather than the Document wrapper
			// so snippets behave like the value nodes users expect
			return (doc.contents as unknown as YamlNode) ?? (doc as unknown as YamlNode);
		},

		walk(root: YamlNode, visitor: NodeVisitor<YamlNode>): void {
			visitNode(root, null, null, visitor);
		},

		locate,
		typeOf,
		getAttribute,
		print,
	};
}

/**
 * Convenience singleton for single-file scripts.
 * For concurrent file processing use `createYamlAdapter()` per file.
 */
export const yamlAdapter = createYamlAdapter();
