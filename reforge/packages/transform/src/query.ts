import type {
	CommentInfo,
	IOriginalSourceMap as OriginalSourceMap,
	ParseResult,
	ParserAdapter,
} from "@reforge/core";
import { parseGapComments, parseTrailingComment } from "@reforge/core";
import { type MutationRecord, Path } from "./path.js";
import { reconcile } from "./reconcile.js";
import {
	matchesSelector,
	type ParsedSelector,
	parseSelector,
} from "./selector.js";

// ─── QueryResult ──────────────────────────────────────────────────────────────

/**
 * A lazy, chainable collection of matched paths.
 *
 * Nothing touches the AST until a terminal operation is called
 * (.mutate(), .remove(), .map(), .forEach(), .count(), .first(), .all()).
 * This means the query can be built up, passed around, and composed
 * before any work happens.
 */
export class QueryResult<TNode extends object> {
	private readonly _context: QueryContext<TNode>;
	private readonly _stages: Stage<TNode>[];

	constructor(context: QueryContext<TNode>, stages: Stage<TNode>[]) {
		this._context = context;
		this._stages = stages;
	}

	// ── Refinement (non-terminal, returns new QueryResult) ─────────────────────

	/** Narrow matches by a predicate function. */
	where(predicate: (path: Path<TNode>) => boolean): QueryResult<TNode> {
		return new QueryResult(this._context, [
			...this._stages,
			{ kind: "where", predicate },
		]);
	}

	/**
	 * Find descendants of each current match.
	 * Scopes the search to the subtree of each matched node.
	 */
	find(selector: string): QueryResult<TNode> {
		const parsed = parseSelector(selector);
		return new QueryResult(this._context, [
			...this._stages,
			{ kind: "find", selector: parsed },
		]);
	}

	/**
	 * Walk up from each match and return the first ancestor of the given type.
	 * Drops matches that have no such ancestor.
	 */
	closest(type: string): QueryResult<TNode> {
		return new QueryResult(this._context, [
			...this._stages,
			{ kind: "closest", type },
		]);
	}

	// ── Terminal operations (execute the walk, apply mutations) ───────────────

	/**
	 * Collect all matched paths without mutating anything.
	 * Useful for inspection, counting, or building up data.
	 */
	all(): Path<TNode>[] {
		return this._execute().paths;
	}

	/** Return the first match, or null. */
	first(): Path<TNode> | null {
		return this.all()[0] ?? null;
	}

	/** Count matches without collecting them. */
	count(): number {
		return this.all().length;
	}

	/** Iterate over matches. */
	forEach(fn: (path: Path<TNode>) => void): void {
		for (const path of this.all()) fn(path);
	}

	/** Map matches to an array of values. */
	map<T>(fn: (path: Path<TNode>) => T): T[] {
		return this.all().map(fn);
	}

	/**
	 * Mutate each match in place.
	 * Mutations are recorded and applied in a single reconciliation pass.
	 * Returns the QueryResult for chaining further reads (not further mutations).
	 */
	mutate(fn: (path: Path<TNode>) => void): this {
		const { paths, mutations } = this._execute();
		for (const path of paths) fn(path);
		reconcile(mutations, this._context.originalMap);
		return this;
	}

	/**
	 * Remove each matched node from its parent.
	 * Shorthand for .mutate(p => p.remove()).
	 */
	remove(): void {
		const { paths, mutations } = this._execute();
		for (const path of paths) path.remove();
		reconcile(mutations, this._context.originalMap);
	}

	/**
	 * Replace each matched node.
	 * The callback receives the current path and should return a replacement node.
	 */
	replaceWith(fn: (path: Path<TNode>) => TNode): void {
		const { paths, mutations } = this._execute();
		for (const path of paths) path.replaceWith(fn(path));
		reconcile(mutations, this._context.originalMap);
	}

	// ── Execution engine ───────────────────────────────────────────────────────

	private _execute(): {
		paths: Path<TNode>[];
		mutations: MutationRecord<TNode>[];
	} {
		const mutations: MutationRecord<TNode>[] = [];
		const { root } = this._context;

		// Build the initial set of paths by walking from the root
		// applying the first stage's find selector, then refine.
		let currentPaths = this._collectInitial(root, mutations);

		for (const stage of this._stages.slice(1)) {
			switch (stage.kind) {
				case "find":
					currentPaths = this._applyFind(
						currentPaths,
						stage.selector,
						mutations,
					);
					break;
				case "where":
					currentPaths = currentPaths.filter(stage.predicate);
					break;
				case "closest":
					currentPaths = currentPaths
						.map((p) => p.closest(stage.type))
						.filter((p): p is Path<TNode> => p !== null);
					break;
			}
		}

		return { paths: currentPaths, mutations };
	}

	/**
	 * Walk the root (or a scoped subtree) and collect paths matching
	 * the first stage's selector.
	 */
	private _collectInitial(
		scopeRoot: TNode,
		mutations: MutationRecord<TNode>[],
	): Path<TNode>[] {
		const firstStage = this._stages[0];
		if (!firstStage || firstStage.kind !== "find") return [];

		const { adapter, originalMap, gapOverrides, source } = this._context;
		const results: Path<TNode>[] = [];
		const ancestorStack: TNode[] = [];

		adapter.walk(scopeRoot, {
			enter(node, parent, key) {
				// Track ancestors for Path construction
				if (parent !== null) {
					// Only push if we're entering a child of the current top
					const top = ancestorStack[ancestorStack.length - 1];
					if (top !== parent) ancestorStack.push(parent);
				}

				if (
					matchesSelector(
						node,
						firstStage.selector,
						adapter.typeOf.bind(adapter),
					)
				) {
					// Determine array index if node is in a list
					let index: number | null = null;
					if (parent && key) {
						const container = (parent as Record<string, unknown>)[key];
						if (Array.isArray(container)) {
							index = (container as TNode[]).indexOf(node);
						}
					}

					results.push(
						new Path({
							node,
							parent: parent ?? null,
							parents: [...ancestorStack],
							key: key ?? null,
							index,
							adapter,
							originalMap,
							mutations,
							gapOverrides,
							source,
						}),
					);
				}
				return undefined;
			},
			leave(_node, parent) {
				const top = ancestorStack[ancestorStack.length - 1];
				if (top === parent) ancestorStack.pop();
			},
		});

		return results;
	}

	/**
	 * For a chained .find() — walk the subtree of each current match
	 * and collect nodes matching the new selector.
	 */
	private _applyFind(
		parents: Path<TNode>[],
		selector: ParsedSelector,
		mutations: MutationRecord<TNode>[],
	): Path<TNode>[] {
		const { adapter, originalMap } = this._context;
		const results: Path<TNode>[] = [];
		const seen = new Set<TNode>();

		for (const parentPath of parents) {
			adapter.walk(parentPath.node, {
				enter(node, parent, key) {
					if (node === parentPath.node) return; // skip the scope root itself
					if (seen.has(node)) return "skip";
					seen.add(node);

					if (matchesSelector(node, selector, adapter.typeOf.bind(adapter))) {
						let index: number | null = null;
						if (parent && key) {
							const container = (parent as Record<string, unknown>)[key];
							if (Array.isArray(container)) {
								index = (container as TNode[]).indexOf(node);
							}
						}

						results.push(
							new Path({
								node,
								parent: parent ?? parentPath.node,
								parents: [...parentPath.parents, parentPath.node],
								key: key ?? null,
								index,
								adapter,
								originalMap,
								mutations,
								gapOverrides: parentPath._gapOverrides,
								source: parentPath._source,
							}),
						);
					}
				},
			});
		}

		return results;
	}
}

// ─── Stage types ─────────────────────────────────────────────────────────────

type Stage<TNode extends object> =
	| { kind: "find"; selector: ParsedSelector }
	| { kind: "where"; predicate: (path: Path<TNode>) => boolean }
	| { kind: "closest"; type: string };

// ─── QueryContext ─────────────────────────────────────────────────────────────

interface QueryContext<TNode extends object> {
	root: TNode;
	adapter: ParserAdapter<TNode>;
	originalMap: OriginalSourceMap<TNode>;
	gapOverrides: import("@reforge/core").ParseResult<TNode>["gapOverrides"];
	source: string;
}

// ─── createQuery ─────────────────────────────────────────────────────────────

/**
 * Create a query builder for a parsed result.
 *
 * @example
 * ```ts
 * const result = parse(source, { adapter: tsAdapter });
 * const query = createQuery(result);
 *
 * query.find("ImportDeclaration[moduleSpecifier=lodash]")
 *      .mutate(p => { p.node.moduleSpecifier = "lodash-es"; });
 *
 * const { code } = print(result);
 * ```
 */
export function createQuery<TNode extends object>(
	result: ParseResult<TNode>,
): QueryBuilder<TNode> {
	const context: QueryContext<TNode> = {
		root: result.ast,
		adapter: result.adapter,
		originalMap: result.originalMap,
		gapOverrides: result.gapOverrides,
		source: result.source,
	};
	return new QueryBuilder(context);
}

// ─── CommentPath ─────────────────────────────────────────────────────────────

/** A comment together with its associated node path. */
export interface CommentPath<TNode extends object> {
	comment: CommentInfo;
	placement: "leading" | "trailing";
	nodePath: Path<TNode>;
	/** Remove this comment. */
	remove(): void;
	/** Replace this comment's raw text. */
	replace(newRaw: string): void;
}

/**
 * The entry point for queries. Call .find() to start a chain.
 */
export class QueryBuilder<TNode extends object> {
	private readonly _context: QueryContext<TNode>;

	constructor(context: QueryContext<TNode>) {
		this._context = context;
	}

	find(selector: string): QueryResult<TNode> {
		const parsed = parseSelector(selector);
		return new QueryResult(this._context, [{ kind: "find", selector: parsed }]);
	}

	/**
	 * Find all comments in the file matching a predicate.
	 * More efficient than query.find("*").where(p => p.comments().some(...))
	 * because it builds the comment index in a single pass.
	 *
	 * @example
	 * // Rename @param across all JSDoc
	 * query.findComments(c => c.text.includes("@param oldName"))
	 *      .forEach(cp => cp.replace(cp.comment.raw.replace("oldName", "newName")));
	 *
	 * // Find all TODO comments
	 * const todos = query.findComments(c => c.text.includes("TODO"));
	 */
	findComments(predicate: (c: CommentInfo) => boolean): CommentPath<TNode>[] {
		const { adapter, originalMap, source, gapOverrides } = this._context;
		const results: CommentPath<TNode>[] = [];
		const mutations: import("./path.js").MutationRecord<TNode>[] = [];

		// prevNodeEnd tracks where the last SIBLING node ended so we can compute
		// the gap between siblings. We use leave() to update it — leave fires
		// inner-to-outer, so we update from leaves first. We only advance it
		// forward (never backward) to prevent container nodes from overwriting
		// the position established by their children.
		let prevNodeEnd = 0;
		// seenNodes: prevents processing the same gap twice when nodes share
		// the same start offset (e.g. wrapper nodes that start at the same
		// position as their first child)
		const seenGapEnd = new Set<number>();

		adapter.walk(this._context.root, {
			enter: (node, parent, key) => {
				const loc = originalMap.originalLocation(node);
				if (!loc) return;

				// Only process each start position once to avoid duplicate comments
				// from wrapper nodes that share start offset with their children.
				if (seenGapEnd.has(loc.start.offset)) return;
				seenGapEnd.add(loc.start.offset);

				// ── Leading comments ──
				const gapStart = prevNodeEnd;
				const gapEnd = loc.start.offset;
				if (gapEnd > gapStart) {
					const gapText = source.slice(gapStart, gapEnd);
					const extractor = adapter.extractComments;
					const comments: CommentInfo[] = extractor
						? extractor(gapText, node, source)
						: parseGapComments(gapText, gapStart);

					for (const c of comments) {
						if (!predicate(c)) continue;
						// Compute array index so _gapBefore() works for comment reads/writes
						let nodeIndex: number | null = null;
						if (parent && key) {
							const container = (parent as Record<string, unknown>)[key];
							if (Array.isArray(container)) {
								nodeIndex = (container as TNode[]).indexOf(node);
							}
						}
						const nodePath = new Path({
							node,
							parent,
							parents: [],
							key: key ?? null,
							index: nodeIndex,
							adapter,
							originalMap,
							gapOverrides,
							source,
							mutations,
						});
						results.push({
							comment: c,
							placement: "leading",
							nodePath,
							remove() {
								nodePath.removeLeadingComments((x) => x.start === c.start);
							},
							replace(newRaw: string) {
								nodePath.replaceLeadingComment(
									(x) => x.start === c.start,
									() => newRaw,
								);
							},
						});
					}
				}

				// ── Trailing comments ──
				const afterText = source.slice(loc.end.offset);
				const trailing = parseTrailingComment(afterText, loc.end.offset);
				if (trailing && predicate(trailing)) {
					let nodeIndex: number | null = null;
					if (parent && key) {
						const container = (parent as Record<string, unknown>)[key];
						if (Array.isArray(container)) {
							nodeIndex = (container as TNode[]).indexOf(node);
						}
					}
					const nodePath = new Path({
						node,
						parent,
						parents: [],
						key: key ?? null,
						index: nodeIndex,
						adapter,
						originalMap,
						gapOverrides,
						source,
						mutations,
					});
					results.push({
						comment: trailing,
						placement: "trailing",
						nodePath,
						remove() {
							nodePath.setTrailingComment(null);
						},
						replace(newRaw: string) {
							nodePath.setTrailingComment(newRaw);
						},
					});
				}
				return undefined;
			},

			leave: (node) => {
				const loc = originalMap.originalLocation(node);
				if (!loc) return;
				// Advance prevNodeEnd forward only — never backward.
				// This means the first leaf to leave() sets prevNodeEnd,
				// and outer containers cannot push it backward.
				if (loc.end.offset > prevNodeEnd) {
					prevNodeEnd = loc.end.offset;
				}
				return undefined;
			},
		});

		return results;
	}
}
