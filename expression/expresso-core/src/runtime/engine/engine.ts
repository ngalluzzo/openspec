import type { EvaluationContext, EvaluationTrace } from "../contracts/types";
import {
	evaluateAsync,
	evaluateRuleAsync,
	evaluateRuleAsyncWithTrace,
} from "./engine-async";
import {
	EvaluationError,
	MaxDepthError,
	UnknownOperatorError,
} from "./engine-errors";
import { shouldTrace } from "./engine-internals";
import { evaluate, evaluateRule, evaluateRuleWithTrace } from "./engine-sync";

export {
	evaluate,
	evaluateAsync,
	evaluateRule,
	evaluateRuleAsync,
	evaluateRuleAsyncWithTrace,
	evaluateRuleWithTrace,
	EvaluationError,
	MaxDepthError,
	UnknownOperatorError,
	shouldTrace,
};

/**
 * Executes `getTrace` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `getTrace`.
 *
 * @example
 * getTrace(ctx);
 */

export function getTrace(
	ctx: EvaluationContext,
): EvaluationTrace[] | undefined {
	return ctx.trace;
}
