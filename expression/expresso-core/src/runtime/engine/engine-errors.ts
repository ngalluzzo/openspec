import type { Rule } from "../contracts/types";

/**
 * Base runtime evaluation failure with rule/depth context for debuggability.
 */
export class EvaluationError extends Error {
	constructor(
		message: string,
		public readonly rule: Rule,
		public readonly depth: number,
	) {
		super(message);
		this.name = "EvaluationError";
	}
}

/**
 * Raised when recursive evaluation exceeds the configured max depth.
 */
export class MaxDepthError extends EvaluationError {
	constructor(rule: Rule, depth: number, maxDepth: number) {
		super(
			`Maximum evaluation depth exceeded (${depth}/${maxDepth})`,
			rule,
			depth,
		);
		this.name = "MaxDepthError";
	}
}

/**
 * Raised when rule dispatch references an operator not present in the registry.
 */
export class UnknownOperatorError extends EvaluationError {
	constructor(operator: string, rule: Rule, depth: number) {
		super(`Unknown operator: "${operator}"`, rule, depth);
		this.name = "UnknownOperatorError";
	}
}
