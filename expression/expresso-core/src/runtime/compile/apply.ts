import type {
	CaughtErrorTrace,
	CompiledFunction,
	CompiledRule,
	DebugResult,
	EvaluationOptions,
	Rule,
} from "../contracts/types";
import { getDefaultOperatorRegistry } from "../../operators/registry";
import {
	evaluateRule,
	evaluateRuleAsync,
	evaluateRuleAsyncWithTrace,
	evaluateRuleWithTrace,
} from "../engine/engine";
import { optimizeRule } from "./optimizer";

const resolveOperatorRegistry = (
	options: EvaluationOptions | undefined,
): EvaluationOptions => {
	const operatorRegistry =
		options?.operatorRegistry ?? getDefaultOperatorRegistry();

	if (operatorRegistry.getAll().size === 0) {
		throw new Error(
			"No operators are loaded in the provided operator registry. Load plugins into an explicit registry before evaluation.",
		);
	}

	return {
		...options,
		operatorRegistry,
	};
};

/**
 * Evaluates a rule against input data using the currently registered operators.
 *
 * @remarks
 * In non-debug mode, rules are optimized before evaluation.
 */
/**
 * Executes `apply` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `apply`.
 *
 * @example
 * apply(rule, data, options);
 */

export function apply<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: EvaluationOptions,
): TOutput {
	const resolvedOptions = resolveOperatorRegistry(options);
	const optimized = resolvedOptions?.debug ? rule : optimizeRule(rule);
	const result = evaluateRule(optimized, data, resolvedOptions);
	return (
		result instanceof Promise
			? (result as Promise<TOutput>).then((r) => r)
			: result
	) as TOutput;
}

/**
 * Executes `applyDebug` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `applyDebug`.
 *
 * @example
 * applyDebug(rule, data, options);
 */

export function applyDebug<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: Omit<EvaluationOptions, "debug">,
): DebugResult<TOutput> & {
	readonly caughtErrors?: readonly CaughtErrorTrace[];
} {
	const resolvedOptions = resolveOperatorRegistry(options);
	const optimized = rule;
	const { result, trace, caughtErrors } = evaluateRuleWithTrace(
		optimized,
		data,
		resolvedOptions,
	);
	return {
		result: result as TOutput,
		trace,
		...(caughtErrors !== undefined && { caughtErrors }),
	};
}

/**
 * Executes `applyAsync` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `applyAsync`.
 *
 * @example
 * applyAsync(rule, data, options);
 */

export async function applyAsync<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: EvaluationOptions,
): Promise<TOutput> {
	const resolvedOptions = resolveOperatorRegistry(options);
	const optimized = resolvedOptions?.debug ? rule : optimizeRule(rule);
	return evaluateRuleAsync(
		optimized,
		data,
		resolvedOptions,
	) as Promise<TOutput>;
}

/**
 * Executes `applyAsyncDebug` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `applyAsyncDebug`.
 *
 * @example
 * applyAsyncDebug(rule, data, options);
 */

export async function applyAsyncDebug<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: Omit<EvaluationOptions, "debug">,
): Promise<
	DebugResult<TOutput> & { readonly caughtErrors?: readonly CaughtErrorTrace[] }
> {
	const resolvedOptions = resolveOperatorRegistry(options);
	const optimized = rule;
	const { result, trace, caughtErrors } = await evaluateRuleAsyncWithTrace(
		optimized,
		data,
		resolvedOptions,
	);
	return {
		result: result as TOutput,
		trace,
		...(caughtErrors !== undefined && { caughtErrors }),
	};
}

/**
 * Executes `compile` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `compile`.
 *
 * @example
 * compile(rule, options);
 */

export function compile<TData = unknown, TOutput = unknown>(
	rule: Rule,
	options?: EvaluationOptions,
): CompiledRule<TData, TOutput> {
	const resolvedOptions = resolveOperatorRegistry(options);
	const operatorRegistry = resolvedOptions.operatorRegistry;
	const optimized = optimizeRule(rule);
	const lazy = options?.lazy ?? true;
	const validateArgs = resolvedOptions.validateArgs ?? false;
	const validateOutput = resolvedOptions.validateOutput ?? false;

	const fn: CompiledFunction<TData, TOutput> = (data: TData) => {
		return evaluateRule(optimized, data, {
			operatorRegistry,
			lazy,
			validateArgs,
			validateOutput,
		} as EvaluationOptions) as TOutput;
	};

	Object.defineProperty(fn, "rule", { value: optimized, enumerable: true });
	Object.defineProperty(fn, "compiled", { value: true, enumerable: true });

	return fn as CompiledRule<TData, TOutput>;
}

/**
 * Compiles debug.
 *
 * @param rule - The `rule` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `compileDebug`.
 *
 * @example
 * compileDebug(rule, options);
 */

export function compileDebug<TData = unknown, TOutput = unknown>(
	rule: Rule,
	options?: Omit<EvaluationOptions, "debug">,
): CompiledRule<
	TData,
	DebugResult<TOutput> & { readonly caughtErrors?: readonly CaughtErrorTrace[] }
> {
	const resolvedOptions = resolveOperatorRegistry(options);
	const operatorRegistry = resolvedOptions.operatorRegistry;
	const optimized = rule;
	const lazy = resolvedOptions.lazy ?? true;
	const validateArgs = resolvedOptions.validateArgs ?? false;
	const validateOutput = resolvedOptions.validateOutput ?? false;

	const fn: CompiledFunction<
		TData,
		DebugResult<TOutput> & {
			readonly caughtErrors?: readonly CaughtErrorTrace[];
		}
	> = (data: TData) => {
		const { result, trace, caughtErrors } = evaluateRuleWithTrace(
			optimized,
			data,
			{
				operatorRegistry,
				lazy,
				validateArgs,
				validateOutput,
				debug: true,
			} as EvaluationOptions,
		);
		return {
			result: result as TOutput,
			trace,
			...(caughtErrors !== undefined && { caughtErrors }),
		};
	};

	Object.defineProperty(fn, "rule", { value: optimized, enumerable: true });
	Object.defineProperty(fn, "compiled", { value: true, enumerable: true });

	return fn as CompiledRule<
		TData,
		DebugResult<TOutput> & {
			readonly caughtErrors?: readonly CaughtErrorTrace[];
		}
	>;
}

/**
 * Executes `isCompiled` with the provided inputs.
 *
 * @param fn - The `fn` argument value.
 *
 * @returns The result produced by `isCompiled`.
 *
 * @example
 * isCompiled(fn);
 */

export function isCompiled(fn: unknown): fn is CompiledRule {
	return (
		typeof fn === "function" &&
		(fn as CompiledRule).compiled === true &&
		typeof (fn as CompiledRule).rule === "object"
	);
}
