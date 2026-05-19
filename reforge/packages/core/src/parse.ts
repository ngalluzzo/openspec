import type { ParserAdapter, ParseResult } from "./types.js";
import { createGapOverrideMap } from "./gaps.js";
import { OriginalSourceMap } from "./OriginalSourceMap.js";

/**
 * Parse a source string into a mutable AST with a sealed shadow-copy index.
 *
 * @example
 * ```ts
 * import { parse } from "@reforge/core";
 * import { tsAdapter } from "@reforge/adapters/typescript";
 *
 * const result = parse(source, { adapter: tsAdapter });
 * // result.ast — mutate freely
 * // result.originalMap — used internally by print()
 * ```
 */
export function parse<TNode extends object>(
	source: string,
	options: { adapter: ParserAdapter<TNode>; parserOptions?: unknown },
): ParseResult<TNode> {
	const { adapter, parserOptions } = options;

	const ast = adapter.parse(source, parserOptions);
	const originalMap = new OriginalSourceMap<TNode>(adapter, source);

	// Walk the full tree and snapshot every node into the shadow-copy.
	adapter.walk(ast, {
		enter(node, _parent, _key) {
			originalMap.snapshot(node);
			return undefined;
		},
	});

	const overrideTargets = new Set<TNode>();
	const gapOverrides = createGapOverrideMap<TNode>(overrideTargets);
	return { ast, originalMap, adapter, source, gapOverrides, overrideTargets };
}

/**
 * Parse a source snippet into a single AST node.
 *
 * This is the idiomatic way to build new nodes for insertion —
 * no pretty-printer required. The snippet's own source text
 * is its "printed" form.
 *
 * @example
 * ```ts
 * const node = snippet(`import React from "react";`, { adapter: tsAdapter });
 *
 * // CSS:
 * const rule = snippet(`.btn:hover { opacity: 0.9; }`, { adapter: cssAdapter });
 * ```
 */
export function snippet<TNode extends object>(
	source: string,
	options: { adapter: ParserAdapter<TNode>; parserOptions?: unknown },
): TNode {
	const { adapter, parserOptions } = options;
	return adapter.parseSnippet(source, parserOptions);
}
