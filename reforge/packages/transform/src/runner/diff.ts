/**
 * Produce a minimal unified diff between two strings.
 *
 * No external dependencies — implements a simple LCS-based line diff.
 * Output format matches `diff -u` closely enough for human reading and
 * standard diff parsers (e.g. GitHub PR review).
 */
export function unifiedDiff(
	original: string,
	modified: string,
	opts: { fromFile?: string; toFile?: string; context?: number } = {},
): string {
	const { fromFile = "original", toFile = "modified", context = 3 } = opts;

	if (original === modified) return "";

	const oldLines = original.split("\n");
	const newLines = modified.split("\n");
	const hunks = computeHunks(oldLines, newLines, context);

	if (hunks.length === 0) return "";

	const header = `--- ${fromFile}\n+++ ${toFile}\n`;
	return header + hunks.map(formatHunk).join("");
}

// ─── Hunk computation ─────────────────────────────────────────────────────────

interface DiffLine {
	kind: "eq" | "del" | "ins";
	text: string;
	oldLine: number; // 1-based, 0 if inserted
	newLine: number; // 1-based, 0 if deleted
}

interface Hunk {
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
	lines: DiffLine[];
}

function computeHunks(
	oldLines: string[],
	newLines: string[],
	context: number,
): Hunk[] {
	const diff = lcs(oldLines, newLines);
	const hunks: Hunk[] = [];
	let i = 0;

	while (i < diff.length) {
		const current = diff[i];
		if (current == null) {
			i++;
			continue;
		}
		// Find next changed line
		if (current.kind === "eq") {
			i++;
			continue;
		}

		// Expand context backward
		const start = Math.max(0, i - context);
		// Expand context forward past the last change in this hunk
		let end = i;
		while (end < diff.length) {
			const check = diff[end];
			if (check == null || check.kind !== "eq") {
				end = Math.min(diff.length, end + context + 1);
			} else {
				// Check if there's another change within context distance
				const nextChange = diff
					.slice(end, end + context + 1)
					.findIndex((l) => l.kind !== "eq");
				if (nextChange === -1) break;
				end = end + nextChange + context + 1;
			}
		}
		end = Math.min(end, diff.length);

		const lines = diff.slice(start, end);
		const oldLines_ = lines.filter((l) => l.kind !== "ins");
		const newLines_ = lines.filter((l) => l.kind !== "del");

		const firstOld = oldLines_[0];
		const firstNew = newLines_[0];
		if (firstOld == null || firstNew == null) {
			i = end;
			continue;
		}

		hunks.push({
			oldStart: firstOld.oldLine,
			oldCount: oldLines_.length,
			newStart: firstNew.newLine,
			newCount: newLines_.length,
			lines,
		});

		i = end;
	}

	return hunks;
}

function formatHunk(hunk: Hunk): string {
	const header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
	const body = hunk.lines
		.map((l) => {
			const prefix = l.kind === "eq" ? " " : l.kind === "del" ? "-" : "+";
			return `${prefix}${l.text}`;
		})
		.join("\n");
	return `${header + body}\n`;
}

// ─── LCS-based line diff ──────────────────────────────────────────────────────

function lcs(oldLines: string[], newLines: string[]): DiffLine[] {
	const m = oldLines.length;
	const n = newLines.length;

	// Build LCS table
	const dp: (number | undefined)[][] = Array.from({ length: m + 1 }, () =>
		new Array(n + 1).fill(0),
	);
	for (let i = m - 1; i >= 0; i--) {
		const oi = oldLines[i];
		if (oi == null) continue;
		for (let j = n - 1; j >= 0; j--) {
			const nj = newLines[j];
			if (nj == null) continue;
			// All dp indices are in bounds since we iterate within array dimensions
			const nextRow = dp[i + 1];
			if (nextRow == null) continue;
			const row = dp[i];
			if (row == null) continue;
			if (oi === nj) {
				const val = nextRow[j + 1];
				if (val != null) row[j] = val + 1;
			} else {
				const a = nextRow[j];
				const b = row[j + 1];
				if (a != null && b != null) {
					row[j] = Math.max(a, b);
				}
			}
		}
	}

	// Walk back through the table to produce the diff
	const result: DiffLine[] = [];
	let i = 0;
	let j = 0;
	let oldLine = 1;
	let newLine = 1;

	while (i < m || j < n) {
		if (i < m && j < n) {
			const oi = oldLines[i];
			const nj = newLines[j];
			if (oi != null && nj != null && oi === nj) {
				result.push({
					kind: "eq",
					text: oi,
					oldLine: oldLine++,
					newLine: newLine++,
				});
				i++;
				j++;
			} else {
				const dpRow = dp[i];
				const dpNextRow = dp[i + 1];
				if (
					j < n &&
					(i >= m ||
						(() => {
							if (dpRow == null || dpNextRow == null) return false;
							const a = dpRow[j + 1];
							const b = dpNextRow[j];
							if (a == null || b == null) return false;
							return a >= b;
						})())
				) {
					const ni = newLines[j];
					if (ni != null)
						result.push({
							kind: "ins",
							text: ni,
							oldLine: 0,
							newLine: newLine++,
						});
					j++;
				} else {
					const oi2 = oldLines[i];
					if (oi2 != null)
						result.push({
							kind: "del",
							text: oi2,
							oldLine: oldLine++,
							newLine: 0,
						});
					i++;
				}
			}
		} else if (j < n) {
			const ni2 = newLines[j];
			if (ni2 != null)
				result.push({ kind: "ins", text: ni2, oldLine: 0, newLine: newLine++ });
			j++;
		} else {
			const oi2 = oldLines[i];
			if (oi2 != null)
				result.push({ kind: "del", text: oi2, oldLine: oldLine++, newLine: 0 });
			i++;
		}
	}

	return result;
}
