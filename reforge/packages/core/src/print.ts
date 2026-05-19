import type {
	ParseResult,
	PrintResult,
	PrintOptions,
	SourceMapV3,
} from "./types.js";
import { isAsiHazard, patchGap, gapCrossesLine } from "./asi.js";
import { applyGapOverride, subtreeContainsOverride } from "./gaps.js";
import { applyCommentOverrides } from "./comments.js";

interface Chunk {
	text: string;
	originalOffset?: number;
	originalLine?: number;
	originalColumn?: number;
	name?: string;
	/**
	 * True when this chunk is a gap emitted inside a modified region.
	 * Only these gaps are candidates for ASI patching — verbatim (unmodified)
	 * gaps are never touched.
	 */
	isModifiedGap?: boolean;
	/** True when this chunk came from a new/modified node (not original source). */
	isModified?: boolean;
}

/**
 * Reprint a parsed (and possibly mutated) AST.
 *
 * Format-preserving guarantee: nodes that were not modified are reprinted
 * verbatim from their original source slice.
 *
 * ASI safety: after the walk, adjacent chunk pairs are scanned for gaps
 * that cross a line boundary with an ASI-hazard starter ( [ ` /
 * Defensive semicolons are inserted into the gap as needed.
 * Only gaps in modified regions are patched — verbatim gaps are untouched.
 */
export function print<TNode extends object>(
	result: ParseResult<TNode>,
	options: PrintOptions = {},
): PrintResult {
	const { ast, originalMap, adapter, source, gapOverrides, overrideTargets } =
		result;
	const { sourceFileName = "source", sourceMapName = "source.map" } = options;

	const chunks: Chunk[] = [];
	let cursor = 0;

	adapter.walk(ast, {
		enter(node, _parent) {
			const loc = originalMap.originalLocation(node);

			// ── New node (no original location) ──────────────────────────────────
			if (!loc) {
				const printed = printNewNode(node, adapter, options);
				chunks.push({ text: printed, isModified: true });
				return "skip";
			}

			// ── Unmodified node ───────────────────────────────────────────────────
			if (!originalMap.isModified(node)) {
				const hasOverrideDescendant =
					overrideTargets.size > 0 &&
					subtreeContainsOverride(
						loc,
						overrideTargets,
						adapter.locate.bind(adapter),
					);

				const override = gapOverrides.get(node);
				const hasGapOverride = override !== undefined;

				// Emit the gap (even if zero-length) whenever:
				//   a) there is source between cursor and this node, OR
				//   b) this node has a gap override (comment/blank-line mutation)
				//      even if the gap is empty — prependComment needs this
				if (loc.start.offset > cursor || hasGapOverride) {
					const rawGap = source.slice(cursor, loc.start.offset);
					const gapWithNewlines = applyGapOverride(rawGap, override, "before");
					const gapText = override?.comments
						? applyCommentOverrides(gapWithNewlines, override.comments, cursor)
						: gapWithNewlines;
					const isDirty = hasGapOverride;
					chunks.push({ text: gapText, isModifiedGap: isDirty });
					cursor = loc.start.offset; // advance even if gap was zero-length
				}

				if (!hasOverrideDescendant && !hasGapOverride) {
					// Fast path: no overrides anywhere — emit verbatim, skip children
					chunks.push({
						text: source.slice(loc.start.offset, loc.end.offset),
						originalOffset: loc.start.offset,
						originalLine: loc.start.line,
						originalColumn: loc.start.column,
					});
					cursor = loc.end.offset;
					return "skip";
				}

				if (!hasOverrideDescendant) {
					// This node itself has the override but no children do —
					// emit the node verbatim and skip children (gap already emitted above)
					chunks.push({
						text: source.slice(loc.start.offset, loc.end.offset),
						originalOffset: loc.start.offset,
						originalLine: loc.start.line,
						originalColumn: loc.start.column,
					});
					cursor = loc.end.offset;
					return "skip";
				}

				// Slow path: descendant has override — recurse into children
				// cursor is already at loc.start from the gap emit above
				if (cursor < loc.start.offset) cursor = loc.start.offset;
			}

			// ── Modified node — recurse into children ─────────────────────────────
			if (loc.start.offset > cursor) {
				const rawGap = source.slice(cursor, loc.start.offset);
				const override = gapOverrides.get(node);
				const gapWithNewlines = applyGapOverride(rawGap, override, "before");
				const gapText = override?.comments
					? applyCommentOverrides(gapWithNewlines, override.comments, cursor)
					: gapWithNewlines;
				chunks.push({ text: gapText, isModifiedGap: true });
				cursor = loc.start.offset;
			}
		},

		leave(node) {
			const loc = originalMap.originalLocation(node);
			if (!loc) return;
			// Advance cursor for both modified nodes AND unmodified nodes that we
			// recursed into (because they contained gap override descendants).
			if (!originalMap.isModified(node)) {
				// Only advance if we actually recursed (cursor moved past start)
				if (cursor > loc.start.offset && loc.end.offset > cursor) {
					// Emit any remaining original source within this node's range
					// that wasn't covered by child chunks (e.g. closing punctuation)
					chunks.push({ text: source.slice(cursor, loc.end.offset) });
					cursor = loc.end.offset;
				}
				return;
			}
			if (loc.end.offset > cursor) {
				cursor = loc.end.offset;
			}
		},
	});

	if (cursor < source.length) {
		chunks.push({ text: source.slice(cursor) });
	}

	// ── ASI safety pass ───────────────────────────────────────────────────────
	// Walk adjacent chunk pairs. When a modified/new node chunk is followed by
	// a gap chunk that crosses a line, and the chunk after that gap starts with
	// an ASI-hazard character, patch the gap with a defensive semicolon.
	const patched = applyAsiPatches(chunks);

	const code = patched.map((c) => c.text).join("");
	const map = buildSourceMap(patched, code, sourceFileName, sourceMapName);

	return { code, map };
}

// ─── ASI patch pass ───────────────────────────────────────────────────────────

function applyAsiPatches(chunks: Chunk[]): Chunk[] {
	// We need a 3-chunk window: [prevNode] [gap] [nextNode]
	// Patch the gap if:
	//   1. prevNode is modified/new (isModified: true) OR gap is isModifiedGap
	//   2. gap crosses a line boundary
	//   3. nextNode starts with an ASI-hazard character
	//   4. prevNode doesn't already end with a safe terminator

	const result: Chunk[] = [...chunks];

	for (let i = 1; i < result.length - 1; i++) {
		const prev = result[i - 1];
		const gap = result[i];
		const next = result[i + 1];

		if (prev == null || gap == null || next == null) continue;

		// Only consider gaps in modified regions
		if (!gap.isModifiedGap && !gap.isModified) continue;
		if (!gapCrossesLine(gap.text)) continue;

		if (isAsiHazard(prev.text, next.text)) {
			result[i] = { ...gap, text: patchGap(gap.text) };
		}
	}

	return result;
}

// ─── New node printing ────────────────────────────────────────────────────────

function printNewNode<TNode extends object>(
	node: TNode,
	adapter: {
		print?: (node: TNode, options?: PrintOptions) => string;
		language: string;
	},
	options: PrintOptions,
): string {
	if (adapter.print) {
		return adapter.print(node, options);
	}
	throw new ReforgeNoPrinterError(adapter.language);
}

export class ReforgeNoPrinterError extends Error {
	constructor(language: string) {
		super(
			`Cannot print a programmatically-built "${language}" node: ` +
				`the adapter does not provide a print() method.\n\n` +
				`Use parse.snippet() to create new nodes from source text instead:\n\n` +
				`  import { snippet } from "@reforge/core";\n` +
				`  const node = snippet(\`your source here\`, { adapter });\n\n` +
				`This is the idiomatic reforge approach — the snippet's own source\n` +
				`text becomes its printed form, no pretty-printer needed.`,
		);
		this.name = "ReforgeNoPrinterError";
	}
}

// ─── Source map generation ────────────────────────────────────────────────────

function buildSourceMap(
	chunks: Chunk[],
	_code: string,
	sourceFileName: string,
	sourceMapName: string,
): SourceMapV3 {
	const names: string[] = [];
	const nameIndex = new Map<string, number>();
	const mappingGroups: string[] = [];

	let _genLine = 0;
	let genCol = 0;
	let prevSrcLine = 0;
	let prevSrcCol = 0;
	let prevNameIdx = 0;

	for (const chunk of chunks) {
		const lines = chunk.text.split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (i > 0) {
				mappingGroups.push(";");
				_genLine++;
				genCol = 0;
			}

			if (chunk.originalLine !== undefined && i === 0) {
				const srcLine = chunk.originalLine - 1;
				const srcCol = chunk.originalColumn ?? 0;

				const segment = [
					encodeVlq(genCol),
					encodeVlq(0),
					encodeVlq(srcLine - prevSrcLine),
					encodeVlq(srcCol - prevSrcCol),
				];

				prevSrcLine = srcLine;
				prevSrcCol = srcCol;

				if (chunk.name) {
					let ni = nameIndex.get(chunk.name);
					if (ni === undefined) {
						ni = names.length;
						names.push(chunk.name);
						nameIndex.set(chunk.name, ni);
					}
					segment.push(encodeVlq(ni - prevNameIdx));
					prevNameIdx = ni;
				}

				if (
					mappingGroups.length > 0 &&
					mappingGroups[mappingGroups.length - 1] !== ";"
				) {
					mappingGroups.push(",");
				}
				mappingGroups.push(segment.join(""));
			}

			const line = lines[i];
			if (line != null) genCol += line.length;
		}
	}

	return {
		version: 3,
		sources: [sourceFileName],
		sourcesContent: [null],
		names,
		mappings: mappingGroups.join(""),
		file: sourceMapName,
	};
}

// ─── VLQ encoding ─────────────────────────────────────────────────────────────

const BASE64 =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function encodeVlq(value: number): string {
	let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
	let result = "";
	do {
		let digit = vlq & 0x1f;
		vlq >>>= 5;
		if (vlq > 0) digit |= 0x20;
		result += BASE64[digit];
	} while (vlq > 0);
	return result;
}
