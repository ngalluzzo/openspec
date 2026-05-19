/**
 * ASI (Automatic Semicolon Insertion) hazard detection and remediation.
 *
 * The hazard: JavaScript does NOT insert a semicolon before a line that starts
 * with one of four token types, even when there's a newline before it:
 *
 *   (   — could continue the previous expression as a call: foo\n(bar) → foo(bar)
 *   [   — could continue as an index:                       foo\n[0]  → foo[0]
 *   `   — could continue as a tagged template:              foo\n`s`  → foo`s`
 *   /   — could be parsed as division:                      foo\n/re/ → foo/re/
 *
 * When the printer splices mutated output, it can introduce these hazards
 * if a node that was originally on the same line as its predecessor ends up
 * on a new line. The fix: detect the hazard in the gap between chunks and
 * insert a defensive semicolon before the newline.
 *
 * Scope of fix: we only patch gaps that the printer controls — i.e. the
 * whitespace between a modified node and its successor. Gaps between two
 * unmodified nodes are emitted verbatim (format-preserving guarantee).
 * If the original source had the hazard, we don't introduce it and we
 * don't fix it — that's the user's problem.
 */

/** Characters that suppress ASI when they start a new logical line. */
const ASI_HAZARD_STARTERS = new Set(["(", "[", "`", "/"]);

/**
 * Returns true if placing `nextSlice` on a new line after `prevSlice`
 * would create an ASI hazard.
 *
 * Both slices should be the printed text of the respective nodes,
 * not including any surrounding whitespace.
 */
export function isAsiHazard(prevSlice: string, nextSlice: string): boolean {
	const lastCh = lastMeaningfulChar(prevSlice);
	const firstCh = firstMeaningfulChar(nextSlice);

	if (firstCh === null || lastCh === null) return false;

	// If the previous node already ends with a statement terminator, safe.
	if (lastCh === ";" || lastCh === "}" || lastCh === "{") return false;

	return ASI_HAZARD_STARTERS.has(firstCh);
}

/**
 * Patch a gap string (the whitespace/comments between two nodes) by
 * inserting a semicolon before the first newline.
 *
 * Only call this when `isAsiHazard` returns true AND the gap contains
 * a newline — calling it on a same-line gap is a no-op anyway, but
 * callers should guard on the newline check for clarity.
 *
 * Handles the line-comment edge case: if the gap before the newline
 * contains a `//` comment, the semicolon is inserted before the comment
 * rather than inside it.
 *
 * @example
 * patchGap('\n  ')            → ';\n  '
 * patchGap('  \n  ')          → ';\n  '
 * patchGap(' // note\n  ')    → '; // note\n  '
 * patchGap('\n\n')            → ';\n\n'
 */
export function patchGap(gap: string): string {
	const firstNewline = gap.indexOf("\n");
	if (firstNewline === -1) return gap; // no newline — nothing to do

	const beforeNewline = gap.slice(0, firstNewline);
	const fromNewline = gap.slice(firstNewline);

	// If there's a line comment before the newline, insert ; before the comment
	// to avoid placing it inside the comment text.
	const commentIdx = beforeNewline.indexOf("//");
	if (commentIdx !== -1) {
		const beforeComment = beforeNewline.slice(0, commentIdx).trimEnd();
		const comment = beforeNewline.slice(commentIdx);
		return `${beforeComment}; ${comment}${fromNewline}`;
	}

	return `${beforeNewline.trimEnd()};${fromNewline}`;
}

/**
 * Returns true if the gap string contains at least one newline —
 * ASI is only relevant across line boundaries.
 */
export function gapCrossesLine(gap: string): boolean {
	return gap.includes("\n");
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function firstMeaningfulChar(s: string): string | null {
	for (const ch of s) {
		if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") return ch;
	}
	return null;
}

function lastMeaningfulChar(s: string): string | null {
	for (let i = s.length - 1; i >= 0; i--) {
		const ch = s[i];
		if (ch != null && ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r")
			return ch;
	}
	return null;
}
