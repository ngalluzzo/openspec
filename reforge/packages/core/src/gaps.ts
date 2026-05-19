import type { SourceLocation } from "./types.js";

/**
 * Blank line control — gap override map and normalization utilities.
 *
 * "Empty line control" (recast issue #147) is implemented as a side-channel
 * that records how many leading newlines should appear before or after a node.
 * The printer consults this map when emitting the gap between two nodes.
 *
 * Like OriginalSourceMap, this uses WeakMap so it never pollutes AST nodes.
 */

export interface GapOverride {
	/** Desired number of leading newlines before this node. */
	before?: number;
	/** Desired number of leading newlines after this node. */
	after?: number;
	/** Comment mutations to apply to the gap. @see CommentOverride */
	comments?: import("./comments.js").CommentOverride;
}

export type GapOverrideMap<TNode extends object> = {
	set(node: TNode, override: GapOverride): void;
	get(node: TNode): GapOverride | undefined;
};

export function createGapOverrideMap<TNode extends object>(
	overrideTargets: Set<TNode>,
): GapOverrideMap<TNode> {
	const map = new WeakMap<object, GapOverride>();
	return {
		set(node, override) {
			const existing = map.get(node) ?? {};
			map.set(node, { ...existing, ...override });
			overrideTargets.add(node);
		},
		get(node) {
			return map.get(node);
		},
	};
}

/**
 * Normalize the number of leading newlines in a gap string.
 *
 * Preserves the indent of the following line (everything after the
 * last newline in the leading whitespace section).
 *
 * @example
 * setLeadingNewlines('\n  ', 2)    → '\n\n  '   (add blank line)
 * setLeadingNewlines('\n\n  ', 1)  → '\n  '     (remove blank line)
 * setLeadingNewlines('\n\n\n  ', 1)→ '\n  '     (collapse multiple)
 * setLeadingNewlines('\n  ', 0)    → '  '       (no newline at all)
 */
export function setLeadingNewlines(gap: string, n: number): string {
	if (n < 0)
		throw new RangeError(`setLeadingNewlines: n must be >= 0, got ${n}`);

	// Find the end of the leading whitespace region (newlines + spaces/tabs)
	// and the position of the last newline within it.
	let lastNewlineIdx = -1;
	let leadingEnd = 0;

	for (let i = 0; i < gap.length; i++) {
		const ch = gap[i];
		if (ch === "\n") {
			lastNewlineIdx = i;
			leadingEnd = i + 1;
		} else if (ch === "\r") {
			leadingEnd = i + 1;
		} else if (ch === " " || ch === "\t") {
			leadingEnd = i + 1;
		} else {
			break; // hit non-whitespace — stop
		}
	}

	// The indent is everything from the last newline to the end of leading whitespace
	const indent =
		lastNewlineIdx === -1 ? "" : gap.slice(lastNewlineIdx + 1, leadingEnd);

	// Everything after the leading whitespace section is preserved verbatim
	const rest = gap.slice(leadingEnd);

	if (n === 0) {
		// No newlines: just the indent (as a same-line space) + rest
		return indent + rest;
	}

	return "\n".repeat(n) + indent + rest;
}

/**
 * Apply a gap override to a gap string.
 * Returns the gap unchanged if no override applies.
 */
export function applyGapOverride(
	gap: string,
	override: GapOverride | undefined,
	position: "before" | "after",
): string {
	const n = position === "before" ? override?.before : override?.after;
	if (n === undefined) return gap;
	return setLeadingNewlines(gap, n);
}

/**
 * Returns true if any node in overrideTargets has a source location that
 * falls within the given node's source range.
 *
 * Used by the printer to decide whether to descend into an unmodified
 * subtree rather than emitting it as a single verbatim slice.
 *
 * Cost: O(|overrideTargets|) — expected to be tiny (< 100 in any real codemod).
 */
export function subtreeContainsOverride<TNode extends object>(
	nodeLoc: SourceLocation,
	overrideTargets: Set<TNode>,
	locateNode: (n: TNode) => SourceLocation | null,
): boolean {
	for (const target of overrideTargets) {
		const targetLoc = locateNode(target);
		if (!targetLoc) continue;
		if (
			targetLoc.start.offset >= nodeLoc.start.offset &&
			targetLoc.end.offset <= nodeLoc.end.offset
		) {
			return true;
		}
	}
	return false;
}
