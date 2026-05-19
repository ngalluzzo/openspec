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

	return `--- ${fromFile}\n+++ ${toFile}\n${hunks.map(formatHunk).join("")}`;
}

interface DiffLine {
	kind: "eq" | "del" | "ins";
	text: string;
	oldLine: number;
	newLine: number;
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
	ctx: number,
): Hunk[] {
	const diff = lcs(oldLines, newLines);
	const hunks: Hunk[] = [];
	let i = 0;
	while (i < diff.length) {
		const line_i = diff[i];
		if (!line_i) {
			i++;
			continue;
		}
		if (line_i.kind === "eq") {
			i++;
			continue;
		}
		const start = Math.max(0, i - ctx);
		let end = i;
		while (end < diff.length) {
			const line_end = diff[end];
			if (!line_end || line_end.kind !== "eq") {
				end = Math.min(diff.length, end + ctx + 1);
			} else {
				const nc = diff
					.slice(end, end + ctx + 1)
					.findIndex((l) => l.kind !== "eq");
				if (nc === -1) break;
				end = end + nc + ctx + 1;
			}
		}
		end = Math.min(end, diff.length);
		const lines = diff.slice(start, end);
		const ol = lines.filter((l) => l.kind !== "ins");
		const nl = lines.filter((l) => l.kind !== "del");
		hunks.push({
			oldStart: ol[0]?.oldLine ?? 1,
			oldCount: ol.length,
			newStart: nl[0]?.newLine ?? 1,
			newCount: nl.length,
			lines,
		});
		i = end;
	}
	return hunks;
}

function formatHunk(h: Hunk): string {
	const body = h.lines
		.map((l) => (l.kind === "eq" ? " " : l.kind === "del" ? "-" : "+") + l.text)
		.join("\n");
	return `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@\n${body}\n`;
}

function lcs(a: string[], b: string[]): DiffLine[] {
	const m = a.length,
		n = b.length;
	const dp: (number | undefined)[][] = Array.from({ length: m + 1 }, () =>
		new Array(n + 1).fill(0),
	);
	for (let i = m - 1; i >= 0; i--) {
		const rowI = dp[i];
		if (!rowI) continue;
		for (let j = n - 1; j >= 0; j--) {
			const rowIPlus1 = dp[i + 1];
			if (!rowIPlus1) continue;
			rowI[j] =
				a[i] === b[j]
					? (rowIPlus1[j + 1] ?? 0) + 1
					: Math.max(rowIPlus1[j] ?? 0, rowI[j + 1] ?? 0);
		}
	}

	const result: DiffLine[] = [];
	let i = 0;
	let j = 0;
	let ol = 1;
	let nl = 1;
	while (i < m || j < n) {
		const ai = a[i];
		if (!ai) {
			i++;
			ol++;
			continue;
		}
		const bj = b[j];
		if (!bj) {
			j++;
			nl++;
			continue;
		}
		if (i < m && j < n && ai === bj) {
			result.push({ kind: "eq", text: ai, oldLine: ol, newLine: nl });
			i++;
			j++;
			ol++;
			nl++;
		} else if (
			j < n &&
			(i >= m || (dp[i]?.[j + 1] ?? 0) >= (dp[i + 1]?.[j] ?? 0))
		) {
			result.push({ kind: "ins", text: bj, oldLine: 0, newLine: nl });
			j++;
			nl++;
		} else {
			result.push({ kind: "del", text: ai, oldLine: ol, newLine: 0 });
			i++;
			ol++;
		}
	}
	return result;
}
