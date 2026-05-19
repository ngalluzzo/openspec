export { parse, snippet } from "./parse.js";
export { print, ReforgeNoPrinterError } from "./print.js";
export { OriginalSourceMap } from "./OriginalSourceMap.js";
export type {
	ParserAdapter,
	ParseResult,
	PrintResult,
	PrintOptions,
	SourceLocation,
	Position,
	NodeVisitor,
	VisitControl,
	OriginalSourceMap as IOriginalSourceMap,
	SourceMapV3,
} from "./types.js";
export { isAsiHazard, patchGap, gapCrossesLine } from "./asi.js";
export {
	createGapOverrideMap,
	setLeadingNewlines,
	applyGapOverride,
	subtreeContainsOverride,
} from "./gaps.js";
export type { GapOverride, GapOverrideMap } from "./gaps.js";
export {
	parseGapComments,
	parseTrailingComment,
	findJsdoc,
	prependCommentToGap,
	stripCommentsFromGap,
	replaceCommentInGap,
	applyCommentOverrides,
} from "./comments.js";
export type { CommentInfo, CommentKind, CommentOverride } from "./comments.js";
export {
	semanticDiff,
	formatSemanticChanges,
} from "./semantic.js";
export type {
	SemanticChange,
	SemanticChangeKind,
	Declaration,
	ExtractDeclarationsFn,
} from "./semantic.js";
