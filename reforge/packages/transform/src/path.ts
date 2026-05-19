import type {
	CommentInfo,
	IOriginalSourceMap as OriginalSourceMap,
	ParserAdapter,
} from "@reforge/core";
import {
	findJsdoc,
	parseGapComments,
	parseTrailingComment,
} from "@reforge/core";

/**
 * A Path wraps a matched AST node with the context needed to act on it.
 *
 * Every callback in the query chain receives a Path, not a raw node.
 * This is intentional: the node alone can't tell you where it lives in
 * the tree, what its siblings are, or how to remove it from its parent.
 * Path carries all of that.
 */
export class Path<TNode extends object> {
	readonly node: TNode;
	readonly parent: TNode | null;
	/** Full ancestor chain, root first. */
	readonly parents: readonly TNode[];
	/** Property name on the parent that holds this node. */
	readonly key: string | null;
	/** Index within a parent array, or null if not in an array. */
	readonly index: number | null;

	/** Original source slice for this node (empty string if node is new). */
	get source(): string {
		return this._originalMap.originalSlice(this.node) ?? "";
	}

	private readonly _adapter: ParserAdapter<TNode>;
	private readonly _originalMap: OriginalSourceMap<TNode>;
	/** Pending mutations, flushed by the reconciliation pass. */
	private readonly _mutations: MutationRecord<TNode>[];
	readonly _gapOverrides: import("@reforge/core").ParseResult<TNode>["gapOverrides"];
	readonly _source: string;

	constructor(opts: {
		node: TNode;
		parent: TNode | null;
		parents: readonly TNode[];
		key: string | null;
		index: number | null;
		adapter: ParserAdapter<TNode>;
		originalMap: OriginalSourceMap<TNode>;
		mutations: MutationRecord<TNode>[];
		gapOverrides: import("@reforge/core").ParseResult<TNode>["gapOverrides"];
		source: string;
	}) {
		this.node = opts.node;
		this.parent = opts.parent;
		this.parents = opts.parents;
		this.key = opts.key;
		this.index = opts.index;
		this._adapter = opts.adapter;
		this._originalMap = opts.originalMap;
		this._mutations = opts.mutations;
		this._gapOverrides = opts.gapOverrides;
		this._source = opts.source;
	}

	// ── Navigation ──────────────────────────────────────────────────────────────

	/**
	 * Walk up the ancestor chain and return the first ancestor whose
	 * type matches. Returns null if none found.
	 */
	closest(type: string): Path<TNode> | null {
		for (let i = this.parents.length - 1; i >= 0; i--) {
			const ancestor = this.parents[i];
			if (ancestor == null) continue;
			if (this._adapter.typeOf(ancestor) === type) {
				const parentAncestor = i > 0 ? (this.parents[i - 1] ?? null) : null;
				// Reconstruct a Path for the ancestor
				return new Path<TNode>({
					node: ancestor,
					parent: parentAncestor,
					parents: this.parents.slice(0, i),
					key: null,
					index: null,
					adapter: this._adapter,
					originalMap: this._originalMap,
					mutations: this._mutations,
					gapOverrides: this._gapOverrides,
					source: this._source,
				});
			}
		}
		return null;
	}

	/** Returns all sibling paths (nodes at the same array position in the parent). */
	siblings(): Path<TNode>[] {
		if (!this.parent || !this.key) return [];
		const arr = (this.parent as Record<string, unknown>)[this.key];
		if (!Array.isArray(arr)) return [];

		return (arr as TNode[])
			.filter((n): n is TNode => n !== this.node)
			.map((n, rawIdx) => {
				const idx = rawIdx >= (this.index ?? 0) ? rawIdx + 1 : rawIdx;
				return new Path<TNode>({
					node: n,
					parent: this.parent,
					parents: this.parents,
					key: this.key,
					index: idx,
					adapter: this._adapter,
					originalMap: this._originalMap,
					mutations: this._mutations,
					gapOverrides: this._gapOverrides,
					source: this._source,
				});
			});
	}

	/** Next sibling in the parent array, or null. */
	next(): Path<TNode> | null {
		if (this.index === null || !this.parent || !this.key) return null;
		const arr = (this.parent as Record<string, unknown>)[this.key];
		if (!Array.isArray(arr)) return null;
		const nextNode = arr[this.index + 1];
		if (nextNode == null) return null;
		return new Path<TNode>({
			node: nextNode,
			parent: this.parent,
			parents: this.parents,
			key: this.key,
			index: this.index + 1,
			adapter: this._adapter,
			originalMap: this._originalMap,
			mutations: this._mutations,
			gapOverrides: this._gapOverrides,
			source: this._source,
		});
	}

	/** Previous sibling in the parent array, or null. */
	prev(): Path<TNode> | null {
		if (this.index === null || this.index === 0 || !this.parent || !this.key)
			return null;
		const arr = (this.parent as Record<string, unknown>)[this.key];
		if (!Array.isArray(arr)) return null;
		const prevNode = arr[this.index - 1];
		if (prevNode == null) return null;
		return new Path<TNode>({
			node: prevNode,
			parent: this.parent,
			parents: this.parents,
			key: this.key,
			index: this.index - 1,
			adapter: this._adapter,
			originalMap: this._originalMap,
			mutations: this._mutations,
			gapOverrides: this._gapOverrides,
			source: this._source,
		});
	}

	// ── Mutation recording ──────────────────────────────────────────────────────
	// None of these mutate the AST directly. They record an intent that
	// is applied by the reconciliation pass after the walk completes.
	// This prevents mid-walk mutations from corrupting traversal order.

	/** Replace this node with another. */
	replaceWith(replacement: TNode): void {
		this._assertHasParent("replaceWith");
		this._mutations.push({ kind: "replace", path: this, replacement });
	}

	/** Remove this node from its parent. */
	remove(): void {
		this._assertHasParent("remove");
		this._mutations.push({ kind: "remove", path: this });
	}

	/** Insert a node immediately before this one in its parent array. */
	insertBefore(node: TNode): void {
		this._assertInArray("insertBefore");
		this._mutations.push({ kind: "insertBefore", path: this, node });
	}

	/** Insert a node immediately after this one in its parent array. */
	insertAfter(node: TNode): void {
		this._assertInArray("insertAfter");
		this._mutations.push({ kind: "insertAfter", path: this, node });
	}

	// ── Blank line control ─────────────────────────────────────────────────────
	// These work by recording a gap override that the printer reads when
	// emitting the whitespace before/after this node. The original source
	// is never touched — only the gap between nodes is normalized.

	/** Ensure exactly n blank lines appear before this node. */
	setBlankLinesBefore(n: number): this {
		this._gapOverrides.set(this.node, { before: n });
		return this;
	}

	/** Ensure exactly n blank lines appear after this node. */
	setBlankLinesAfter(n: number): this {
		this._gapOverrides.set(this.node, { after: n });
		return this;
	}

	/** Ensure exactly one blank line before this node. */
	ensureBlankLineBefore(): this {
		return this.setBlankLinesBefore(1);
	}

	/** Ensure exactly one blank line after this node. */
	ensureBlankLineAfter(): this {
		return this.setBlankLinesAfter(1);
	}

	/** Remove all blank lines before this node (single newline only). */
	removeBlankLinesBefore(): this {
		return this.setBlankLinesBefore(0);
	}

	/** Remove all blank lines after this node (single newline only). */
	removeBlankLinesAfter(): this {
		return this.setBlankLinesAfter(0);
	}

	// ── Comment reading ──────────────────────────────────────────────────────────
	// Comments are read from the original source gap before/after this node.
	// For unmodified nodes the gap is always available via the original source.
	// For new nodes (no original location) there is no gap — returns [].

	/**
	 * Compute the gap (whitespace + comments) that appears before this node
	 * in the source, using sibling/parent locations for exact bounds.
	 *
	 * Strategy:
	 *   - If this node is in a parent array (index !== null):
	 *       gap = source.slice(prevSibling.end, node.start)   (index > 0)
	 *       gap = source.slice(parent.start, node.start)      (index == 0)
	 *   - If this node is a named property child (index === null):
	 *       return null — named children are structurally part of their parent
	 *       and don't have meaningful standalone leading comments.
	 *   - If there is no parent:
	 *       gap = source.slice(0, node.start)
	 *
	 * This is exact — no heuristics, no backward scanning.
	 */
	private _gapBefore(): { text: string; offset: number } | null {
		const loc = this._originalMap.originalLocation(this.node);
		if (!loc) return null;

		// Named property children: no meaningful gap
		if (this.parent !== null && this.index === null) return null;

		let gapStart: number;

		if (this.parent === null) {
			// Root node or detached node: gap is from 0 to node start
			gapStart = 0;
		} else if (this.index !== null && this.index > 0 && this.key !== null) {
			// Has a previous sibling — gap starts at prev sibling's end
			const siblings = (this.parent as Record<string, unknown>)[
				this.key
			] as this["node"][];
			const prevSibling = siblings[this.index - 1];
			const prevLoc = prevSibling
				? this._originalMap.originalLocation(prevSibling)
				: null;
			gapStart = prevLoc ? prevLoc.end.offset : 0;
		} else {
			// First child in array — gap starts at parent's start offset
			const parentLoc = this._originalMap.originalLocation(this.parent);
			gapStart = parentLoc ? parentLoc.start.offset : 0;
		}

		return {
			text: this._source.slice(gapStart, loc.start.offset),
			offset: gapStart,
		};
	}

	/** Comments in the gap immediately before this node. */
	leadingComments(): CommentInfo[] {
		const adapter = this._adapter;
		const gap = this._gapBefore();
		if (!gap) return [];
		if (adapter.extractComments) {
			return adapter.extractComments(gap.text, this.node, this._source);
		}
		return parseGapComments(gap.text, gap.offset);
	}

	/** Trailing inline comment on the same line as this node. */
	trailingComments(): CommentInfo[] {
		const loc = this._originalMap.originalLocation(this.node);
		if (!loc) return [];
		const afterText = this._source.slice(loc.end.offset);
		const c = parseTrailingComment(afterText, loc.end.offset);
		return c ? [c] : [];
	}

	/** All comments associated with this node (leading + trailing). */
	comments(): CommentInfo[] {
		return [...this.leadingComments(), ...this.trailingComments()];
	}

	/**
	 * The JSDoc block comment immediately before this node, or null.
	 * JSDoc = a block comment whose raw form starts with /**
	 */
	jsdoc(): CommentInfo | null {
		return findJsdoc(this.leadingComments());
	}

	// ── Comment writing ───────────────────────────────────────────────────────────
	// These record CommentOverride entries in the GapOverrideMap.
	// The printer applies them when emitting the gap before/after this node.
	// All return `this` for chaining with blank-line methods.

	/**
	 * Prepend a comment before this node.
	 * Pass the raw comment text including delimiters (// or /** ... *\/).
	 *
	 * @example
	 * path.addLeadingComment("// generated by codemod")
	 * path.addLeadingComment("/** @deprecated use newFn *\/")
	 */
	addLeadingComment(commentText: string): this {
		this._gapOverrides.set(this.node, {
			comments: { prependComment: commentText },
		});
		return this;
	}

	/**
	 * Remove leading comments.
	 * Pass a predicate to remove only matching comments; omit to remove all.
	 */
	removeLeadingComments(predicate?: (c: CommentInfo) => boolean): this {
		if (predicate) {
			this._gapOverrides.set(this.node, {
				comments: { stripLeadingComments: predicate },
			});
		} else {
			this._gapOverrides.set(this.node, {
				comments: { stripAllLeadingComments: true },
			});
		}
		return this;
	}

	/**
	 * Replace a leading comment matching the predicate.
	 * The replacer receives the matched CommentInfo and returns the new raw text.
	 */
	replaceLeadingComment(
		match: (c: CommentInfo) => boolean,
		replacer: (c: CommentInfo) => string,
	): this {
		// We need the current comment text to build the replacement.
		// Resolve it eagerly so the closure captures the right value.
		const current = this.leadingComments().find(match);
		if (!current) return this;
		this._gapOverrides.set(this.node, {
			comments: {
				replaceLeadingComment: {
					match,
					replacement: replacer(current),
				},
			},
		});
		return this;
	}

	/**
	 * Set or replace the trailing inline comment on this node's line.
	 * Pass null to remove it.
	 */
	setTrailingComment(text: string | null): this {
		this._gapOverrides.set(this.node, {
			comments: { setTrailingComment: text },
		});
		return this;
	}

	// ── Helpers ─────────────────────────────────────────────────────────────────

	private _assertHasParent(op: string): void {
		if (!this.parent || !this.key) {
			throw new PathError(
				`Cannot call .${op}() on a node with no parent (is this the root node?)`,
			);
		}
	}

	private _assertInArray(op: string): void {
		this._assertHasParent(op);
		if (this.index === null) {
			throw new PathError(
				`Cannot call .${op}() on a node that is not in an array ` +
					`(it is a named property, not a list item)`,
			);
		}
	}
}

// ─── Mutation records ─────────────────────────────────────────────────────────

export type MutationRecord<TNode extends object> =
	| { kind: "replace"; path: Path<TNode>; replacement: TNode }
	| { kind: "remove"; path: Path<TNode> }
	| { kind: "insertBefore"; path: Path<TNode>; node: TNode }
	| { kind: "insertAfter"; path: Path<TNode>; node: TNode };

export class PathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PathError";
	}
}
