/**
 * Stable logical operator identifiers shared across plugins, manifests, and
 * operator-package tooling. Runtime rule keys may differ (see plugin
 * `operatorBindings`).
 */
export const CoreOperatorIds = {
	var: "var",
	eq: "eq",
	strictEq: "strict_eq",
	neq: "neq",
	gt: "gt",
	gte: "gte",
	lt: "lt",
	lte: "lte",
} as const;

export type CoreOperatorId =
	(typeof CoreOperatorIds)[keyof typeof CoreOperatorIds];
