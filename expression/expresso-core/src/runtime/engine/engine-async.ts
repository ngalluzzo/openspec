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
 * Async evaluation entrypoint that normalizes options into an execution
 * context and resolves the fully evaluated rule result.
 */
/**
 * Executes `evaluateRuleAsync` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `evaluateRuleAsync`.
 *
 * @example
 * evaluateRuleAsync(rule, data, options);
 */

export async function evaluateRuleAsync(
	rule: Rule,
	data: unknown,
	options: EvaluationOptions = {},
): Promise<unknown> {
	const evaluation = buildEvaluationContext({ data, options });
	const result = await evaluateAsync(
		rule,
		data,
		evaluation.ctx,
		evaluation.validateArgs,
		evaluation.validateOutput,
	);

	return unwrapDataMarker(result);
}

/**
 * Async evaluation entrypoint that always captures operator-level trace
 * entries regardless of incoming `debug` option value.
 */
/**
 * Executes `evaluateRuleAsyncWithTrace` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `evaluateRuleAsyncWithTrace`.
 *
 * @example
 * evaluateRuleAsyncWithTrace(rule, data, options);
 */

export async function evaluateRuleAsyncWithTrace(
	rule: Rule,
	data: unknown,
	options: EvaluationOptions = {},
): Promise<{
	result: unknown;
	trace: EvaluationTrace[];
	caughtErrors?: CaughtErrorTrace[];
}> {
	const evaluation = buildEvaluationContext({
		data,
		options,
		forceTrace: true,
	});
	const result = await evaluateAsync(
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
 * Executes `evaluateAsync` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param ctx - The `ctx` argument value.
 * @param validateArgs - The `validateArgs` argument value.
 * @param validateOutput - The `validateOutput` argument value.
 *
 * @returns The result produced by `evaluateAsync`.
 *
 * @example
 * evaluateAsync(rule, data, ctx, validateArgs, validateOutput);
 */

export async function evaluateAsync(
	rule: Rule,
	data: unknown,
	ctx: EvaluationContext,
	validateArgs: boolean,
	validateOutput: boolean,
): Promise<unknown> {
	if (isPrimitive(rule)) {
		return rule;
	}

	if (Array.isArray(rule)) {
		if (isStaticArray(rule)) {
			return rule;
		}
		return await Promise.all(
			(rule as readonly Rule[]).map((item) =>
				evaluateAsync(item, data, ctx, validateArgs, validateOutput),
			),
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
				result[key] = await evaluateAsync(
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
				result[k] = await evaluateAsync(
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
			evaluatedArgs = await Promise.all(
				args.map(async (arg) => {
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
					const evaluated = await evaluateAsync(
						arg as Rule,
						data,
						ctx,
						validateArgs,
						validateOutput,
					);
					return operator === "var" ? evaluated : unwrapDataMarker(evaluated);
				}),
			);
			ctx.depth--;
		} else {
			ctx.depth++;
			evaluatedArgs = await Promise.all(
				args.map(async (arg) => {
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
					const evaluated = await evaluateAsync(
						arg as Rule,
						data,
						ctx,
						validateArgs,
						validateOutput,
					);
					return operator === "var" ? evaluated : unwrapDataMarker(evaluated);
				}),
			);
			ctx.depth--;
		}

		const result = await op.handler(evaluatedArgs, data, ctx);

		if (validateOutput && op.outputSchema) {
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
