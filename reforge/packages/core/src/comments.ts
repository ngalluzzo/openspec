/**
 * Comment API for reforge.
 *
 * Design principle: comments are gap annotations.
 * They live in the trivia space between tokens (TS model) or as child nodes
 * (PostCSS model), but in both cases they appear in the *gap* before or
 * after a meaningful AST node. The GapOverrideMap is the right abstraction
 * for storing comment mutations — no fake comment nodes, no extra WeakMap.
 *
 * This module provides:
 *   1. CommentInfo — the universal comment descriptor
 *   2. parseGapComments() — generic gap string scanner (works for all languages)
 *   3. Gap comment mutation functions — used by Path methods
 *   4. applyCommentOverrides() — called by the printer to apply mutations
 */

// ─── CommentInfo ─────────────────────────────────────────────────────────────

export type CommentKind = "line" | "block";

export interface CommentInfo {
	/** "line" = // comment   "block" = block comment */
	kind: CommentKind;
	/** Content without delimiters or leading asterisks. Trimmed. */
	text: string;
	/** Original source text including delimiters. */
	raw: string;
	/** Byte offset of the start of the comment in the original source. */
	start: number;
	/** Byte offset just past the end of the comment in the original source. */
	end: number;
}

// ─── Gap comment parsing ──────────────────────────────────────────────────────

/**
 * Parse all comments from a gap string (the whitespace/trivia between nodes).
 *
 * Handles:
 *   // line comments
 *   /* block comments (single and multi-line) *\/
 *   Nested content, strings inside comments, etc. are NOT parsed —
 *   we only care about the top-level comment structure.
 *
 * @param gap  The gap text (source.slice(prevNode.end, nextNode.start))
 * @param baseOffset  The byte offset of gap[0] in the original source.
 *                    Used to produce absolute positions in CommentInfo.
 */
export function parseGapComments(gap: string, baseOffset = 0): CommentInfo[] {
	const comments: CommentInfo[] = [];
	let i = 0;

	while (i < gap.length) {
		// Skip non-comment characters
		if (gap[i] !== "/") {
			i++;
			continue;
		}
		if (i + 1 >= gap.length) {
			i++;
			continue;
		}

		if (gap[i + 1] === "/") {
			// Line comment: // … \n
			const start = i;
			i += 2;
			while (i < gap.length && gap[i] !== "\n") i++;
			const raw = gap.slice(start, i);
			const text = raw.slice(2).trim();
			comments.push({
				kind: "line",
				text,
				raw,
				start: baseOffset + start,
				end: baseOffset + i,
			});
		} else if (gap[i + 1] === "*") {
			// Block comment: /* … */
			const start = i;
			i += 2;
			while (i < gap.length - 1 && !(gap[i] === "*" && gap[i + 1] === "/")) i++;
			i += 2; // consume closing */
			const raw = gap.slice(start, i);
			const text = extractBlockCommentText(raw);
			comments.push({
				kind: "block",
				text,
				raw,
				start: baseOffset + start,
				end: baseOffset + i,
			});
		} else {
			i++;
		}
	}

	return comments;
}

/**
 * Extract clean text from a block comment, stripping leading * on each line
 * (the JSDoc convention).
 *
 * @example
 * extractBlockCommentText("/* hello *\/")          → "hello"
 * extractBlockCommentText("/**\n * @param x\n *\/") → "@param x"
 */
function extractBlockCommentText(raw: string): string {
	// Strip /* and */
	const inner = raw
		.slice(2, raw.endsWith("*/") ? raw.length - 2 : undefined)
		.trim();

	// Split into lines, strip leading * (JSDoc style)
	const lines = inner.split("\n").map((line) => {
		const trimmed = line.trim();
		return trimmed.startsWith("*") ? trimmed.slice(1).trim() : trimmed;
	});

	return lines.filter((l) => l.length > 0).join("\n");
}

// ─── JSDoc detection ──────────────────────────────────────────────────────────

/**
 * Returns the JSDoc comment (leading block comment starting with /**)
 * from a list of comments, or null if none exists.
 */
export function findJsdoc(comments: CommentInfo[]): CommentInfo | null {
	for (const c of [...comments].reverse()) {
		// JSDoc = block comment whose raw form starts with /**
		if (c.kind === "block" && c.raw.startsWith("/**")) return c;
	}
	return null;
}

// ─── Trailing comment extraction ─────────────────────────────────────────────

/**
 * Extract a trailing inline comment from the text that immediately follows
 * a node on the same line.
 *
 * Trailing comments are on the same line as the node, separated only by
 * whitespace (no newline between node end and comment).
 *
 * @param afterText  source text after node.end
 * @param baseOffset  byte offset of afterText[0] in the original source
 */
export function parseTrailingComment(
	afterText: string,
	baseOffset = 0,
): CommentInfo | null {
	// Only look at text before the first newline
	const newlineIdx = afterText.indexOf("\n");
	const sameLine =
		newlineIdx === -1 ? afterText : afterText.slice(0, newlineIdx);

	const trimmed = sameLine.trimStart();
	if (!trimmed.startsWith("//") && !trimmed.startsWith("/*")) return null;

	const leadingSpaces = sameLine.length - trimmed.length;
	const comments = parseGapComments(trimmed, baseOffset + leadingSpaces);
	return comments[0] ?? null;
}

// ─── Gap comment mutations ────────────────────────────────────────────────────
// These functions take a gap string and return a modified version.
// They are called by the printer when processing GapOverride entries
// that carry comment-mutation instructions.

/**
 * Prepend a comment (and a trailing newline) to a gap string.
 * Preserves the existing indent of the following line.
 *
 * @example
 * prependCommentToGap("\n  ", "// hello")  → "// hello\n  "
 * prependCommentToGap("\n\n  ", "// hello") → "// hello\n\n  "
 */
export function prependCommentToGap(gap: string, commentText: string): string {
	const comment = commentText.trimEnd();
	// Keep everything from the first newline onward (preserves the indent).
	const firstNewline = gap.indexOf("\n");
	const tail = firstNewline === -1 ? "" : gap.slice(firstNewline + 1);
	return `${comment}\n${tail}`;
}

/**
 * Remove comment lines from a gap string.
 *
 * @param gap          The gap string to process
 * @param predicate    If provided, only removes comments matching this test.
 *                     If omitted, removes all comments.
 * @param baseOffset   Byte offset of gap[0] in the original source
 */
export function stripCommentsFromGap(
	gap: string,
	predicate?: (c: CommentInfo) => boolean,
	baseOffset = 0,
): string {
	const comments = parseGapComments(gap, baseOffset);
	if (comments.length === 0) return gap;

	// Build a list of ranges to remove (relative to gap start)
	const toRemove: Array<{ start: number; end: number }> = [];

	for (const c of comments) {
		const relStart = c.start - baseOffset;
		const relEnd = c.end - baseOffset;

		if (predicate && !predicate(c)) continue;

		// Extend range to include the newline after a line comment
		let end = relEnd;
		if (c.kind === "line" && gap[relEnd] === "\n") end++;

		toRemove.push({ start: relStart, end });
	}

	if (toRemove.length === 0) return gap;

	// Apply removals back-to-front to preserve indices
	toRemove.sort((a, b) => b.start - a.start);
	let result = gap;
	for (const { start, end } of toRemove) {
		result = result.slice(0, start) + result.slice(end);
	}
	return result;
}

/**
 * Replace a specific comment in a gap string.
 *
 * @param gap         The gap string to process
 * @param match       Predicate to identify the target comment
 * @param replacement New raw comment text (must include // or /* ... *\/)
 * @param baseOffset  Byte offset of gap[0] in the original source
 */
export function replaceCommentInGap(
	gap: string,
	match: (c: CommentInfo) => boolean,
	replacement: string,
	baseOffset = 0,
): string {
	const comments = parseGapComments(gap, baseOffset);
	let result = gap;

	// Work back-to-front to preserve indices
	for (let i = comments.length - 1; i >= 0; i--) {
		const c = comments[i];
		if (c == null || !match(c)) continue;
		const relStart = c.start - baseOffset;
		const relEnd = c.end - baseOffset;
		result = result.slice(0, relStart) + replacement + result.slice(relEnd);
		break; // replace first match only (callers loop for multiple)
	}

	return result;
}

// ─── GapOverride extensions ───────────────────────────────────────────────────
// These are stored in GapOverrideMap and read by the printer.

export interface CommentOverride {
	/** Raw comment text to prepend before the node (including delimiters). */
	prependComment?: string;
	/** Remove all leading comments. */
	stripAllLeadingComments?: boolean;
	/** Remove only leading comments matching this predicate. */
	stripLeadingComments?: (c: CommentInfo) => boolean;
	/** Replace a leading comment. */
	replaceLeadingComment?: {
		match: (c: CommentInfo) => boolean;
		replacement: string;
	};
	/** Set or replace the trailing inline comment. null = remove. */
	setTrailingComment?: string | null;
}

/**
 * Apply all comment overrides to a gap string.
 * Called by the printer after applying blank-line overrides.
 */
export function applyCommentOverrides(
	gap: string,
	override: CommentOverride,
	baseOffset = 0,
): string {
	let result = gap;

	if (override.stripAllLeadingComments) {
		result = stripCommentsFromGap(result, undefined, baseOffset);
	} else if (override.stripLeadingComments) {
		result = stripCommentsFromGap(
			result,
			override.stripLeadingComments,
			baseOffset,
		);
	}

	if (override.replaceLeadingComment) {
		const { match, replacement } = override.replaceLeadingComment;
		result = replaceCommentInGap(result, match, replacement, baseOffset);
	}

	if (override.prependComment) {
		result = prependCommentToGap(result, override.prependComment);
	}

	return result;
}
