export { createQuery, QueryBuilder, QueryResult } from "./query.js";
export type { CommentPath } from "./query.js";
export { Path, PathError, type MutationRecord } from "./path.js";
export {
	parseSelector,
	matchesSelector,
	SelectorParseError,
} from "./selector.js";
export type { ParsedSelector, AttributeConstraint } from "./selector.js";

// Runner is a separate entrypoint — import from "@reforge/transform/runner"
// to avoid pulling Node.js fs/path APIs into browser builds.
// export * from "./runner/index.js"  ← don't re-export here
