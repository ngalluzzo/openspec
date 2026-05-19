import type {
	CaughtErrorTrace,
	EvaluationContext,
	EvaluationOptions,
	EvaluationTrace,
	Rule,
} from "../contracts/types";
import { isPrimitive, isStaticArray } from "../shared/utils";
import { buildEvaluationContext } from "./engine-context";
import {
	EvaluationError,
	MaxDepthError,
	UnknownOperatorError,
} from "./engine-errors";
import {
	addTrace,
	isDataMarkerValue,
	isOperatorRule,
	isValidDataMarker,
	shouldTrace,
	unwrapDataMarker,
	validateDataMarkerContent,
	wrapDataMarker,
} from "./engine-internals";

/**
 * Synchronous evaluation entrypoint that normalizes options into an execution
 * context and returns unwrapped literal data-marker results.
 */
/**
 * Executes `evaluateRule` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `evaluateRule`.
 *
 * @example
 * evaluateRule(rule, data, options);
 */

export function evaluateRule(
	rule: Rule,
	data: unknown,
	options: EvaluationOptions = {},
): unknown {
	const evaluation = buildEvaluationContext({ data, options });
	const result = evaluate(
		rule,
		data,
		evaluation.ctx,
		evaluation.validateArgs,
		evaluation.validateOutput,
	);

	return unwrapDataMarker(result);
}

/**
 * Synchronous evaluation entrypoint that always captures operator-level trace
 * entries regardless of incoming `debug` option value.
 */
/**
 * Executes `evaluateRuleWithTrace` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `evaluateRuleWithTrace`.
 *
 * @example
 * evaluateRuleWithTrace(rule, data, options);
 */

export function evaluateRuleWithTrace(
	rule: Rule,
	data: unknown,
	options: EvaluationOptions = {},
): {
	result: unknown;
	trace: EvaluationTrace[];
	caughtErrors?: CaughtErrorTrace[];
} {
	const evaluation = buildEvaluationContext({
		data,
		options,
		forceTrace: true,
	});
	const result = evaluate(
		rule,
		data,
		evaluation.ctx,
		evaluation.validateArgs,
		evaluation.validateOutput,
	);
	const trace = evaluation.trace ?? [];

	return {
		result: unwrapDataMarker(result),
		trace,
		...(evaluation.caughtErrors !== undefined && {
			caughtErrors: evaluation.caughtErrors,
		}),
	};
}

/**
 * Executes `evaluate` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param ctx - The `ctx` argument value.
 * @param validateArgs - The `validateArgs` argument value.
 * @param validateOutput - The `validateOutput` argument value.
 *
 * @returns The result produced by `evaluate`.
 *
 * @example
 * evaluate(rule, data, ctx, validateArgs, validateOutput);
 */

export function evaluate(
	rule: Rule,
	data: unknown,
	ctx: EvaluationContext,
	validateArgs: boolean,
	validateOutput: boolean,
): unknown {
	if (isPrimitive(rule)) {
		return rule;
	}

	if (Array.isArray(rule)) {
		if (isStaticArray(rule)) {
			return rule;
		}
		return (rule as readonly Rule[]).map((item) =>
			evaluate(item, data, ctx, validateArgs, validateOutput),
		);
	}

	if (typeof rule === "object" && rule !== null) {
		if (isDataMarkerValue(rule)) {
			return unwrapDataMarker(rule);
		}

		const entries = Object.entries(rule);

		const firstEntry = entries[0];
		if (entries.length === 1 && firstEntry && firstEntry[0] === "@data") {
			if (isValidDataMarker(rule)) {
				const dataValue = rule["@data"];
				validateDataMarkerContent(dataValue, rule, ctx.operatorRegistry);

				const wrapped = wrapDataMarker(dataValue);

				if (shouldTrace(ctx)) {
					addTrace(ctx, {
						depth: ctx.depth,
						operator: "@data",
						args: [dataValue],
						result: dataValue,
						timestamp: Date.now(),
					});
				}

				return wrapped;
			}
		}

		if (entries.length !== 1) {
			if (ctx.depth === 0) {
				throw new EvaluationError(
					`Invalid rule: expected exactly one operator, got ${entries.length}`,
					rule,
					ctx.depth,
				);
			}
			const result: Record<string, unknown> = {};
			for (const [key, value] of entries) {
				result[key] = evaluate(
					value as Rule,
					data,
					ctx,
					validateArgs,
					validateOutput,
				);
			}
			return result;
		}

		const firstEntryForKey = entries[0];
		if (!firstEntryForKey) {
			throw new EvaluationError(
				`Invalid rule: no operator found`,
				rule,
				ctx.depth,
			);
		}
		const [key] = firstEntryForKey;
		if (!ctx.operatorRegistry.has(key) && ctx.depth > 0) {
			const result: Record<string, unknown> = {};
			for (const [k, value] of entries) {
				result[k] = evaluate(
					value as Rule,
					data,
					ctx,
					validateArgs,
					validateOutput,
				);
			}
			return result;
		}

		const entry = entries[0];
		if (!entry) {
			throw new EvaluationError(
				`Invalid rule: no operator found`,
				rule,
				ctx.depth,
			);
		}

		const [operator, rawValue] = entry;
		const args = Array.isArray(rawValue) ? rawValue : [rawValue];

		if (ctx.depth >= ctx.maxDepth) {
			throw new MaxDepthError(rule, ctx.depth, ctx.maxDepth);
		}

		const op = ctx.operatorRegistry.get(operator);
		if (!op) {
			throw new UnknownOperatorError(operator, rule, ctx.depth);
		}

		if (validateArgs && op.inputSchema) {
			const result = op.inputSchema.safeParse(args);
			if (!result.success) {
				throw new EvaluationError(
					`Invalid arguments for operator "${operator}": ${result.error.message}`,
					rule,
					ctx.depth,
				);
			}
		}

		const shouldEvaluateLazy = ctx.lazy && !op.eager;
		const shouldPreserveRules =
			op.preserveRules ?? op.metadata?.preserveRules ?? false;
		const shouldPreserveRawArrays =
			op.preserveRawArrays ?? op.metadata?.preserveRawArrays ?? false;

		let evaluatedArgs: unknown[];
		if (shouldEvaluateLazy) {
			ctx.depth++;
			evaluatedArgs = args.map((arg) => {
				if (shouldPreserveRules && isOperatorRule(arg, ctx)) {
					return arg;
				}
				if (
					shouldPreserveRawArrays &&
					Array.isArray(arg) &&
					!isStaticArray(arg)
				) {
					return arg;
				}
				const evaluated = evaluate(
					arg as Rule,
					data,
					ctx,
					validateArgs,
					validateOutput,
				);
				return operator === "var" ? evaluated : unwrapDataMarker(evaluated);
			});
			ctx.depth--;
		} else {
			ctx.depth++;
			evaluatedArgs = args.map((arg) => {
				if (shouldPreserveRules && isOperatorRule(arg, ctx)) {
					return arg;
				}
				if (
					shouldPreserveRawArrays &&
					Array.isArray(arg) &&
					!isStaticArray(arg)
				) {
					return arg;
				}
				const evaluated = evaluate(
					arg as Rule,
					data,
					ctx,
					validateArgs,
					validateOutput,
				);
				return operator === "var" ? evaluated : unwrapDataMarker(evaluated);
			});
			ctx.depth--;
		}

		let result: unknown;
		if (op.async) {
			result = Promise.resolve(op.handler(evaluatedArgs, data, ctx));
		} else {
			result = op.handler(evaluatedArgs, data, ctx);
		}

		if (validateOutput && op.outputSchema) {
			if (result instanceof Promise) {
				throw new EvaluationError(
					`Cannot validate output for async operator "${operator}" in sync evaluation`,
					rule,
					ctx.depth,
				);
			}

			const outputParse = op.outputSchema.safeParse(result);
			if (!outputParse.success) {
				throw new EvaluationError(
					`Invalid output for operator "${operator}": ${outputParse.error.message}`,
					rule,
					ctx.depth,
				);
			}
		}

		if (shouldTrace(ctx)) {
			addTrace(ctx, {
				depth: ctx.depth,
				operator,
				args: evaluatedArgs,
				result,
				timestamp: Date.now(),
			});
		}

		return result;
	}

	throw new EvaluationError(
		`Invalid rule type: ${typeof rule}`,
		rule,
		ctx.depth,
	);
}
