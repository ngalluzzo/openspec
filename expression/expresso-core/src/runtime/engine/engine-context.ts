import type {
	CaughtErrorTrace,
	EvaluationContext,
	EvaluationOptions,
	EvaluationTrace,
} from "../contracts/types";

/**
 * Builds evaluation context.
 *
 * @param input - Composite input payload for this operation.
 *
 * @returns The result produced by `buildEvaluationContext`.
 *
 * @example
 * buildEvaluationContext(input);
 */

export function buildEvaluationContext(input: {
	data: unknown;
	options: EvaluationOptions;
	forceTrace?: boolean;
}): {
	ctx: EvaluationContext;
	validateArgs: boolean;
	validateOutput: boolean;
	trace?: EvaluationTrace[];
	caughtErrors?: CaughtErrorTrace[];
} {
	if (!input.options.operatorRegistry) {
		throw new Error(
			"Expresso evaluation requires an explicit operator registry.",
		);
	}

	const maxDepth = input.options.maxDepth ?? 100;
	const lazy = input.options.lazy ?? true;
	const debug = input.forceTrace || input.options.debug === true;
	const validateArgs = input.options.validateArgs ?? false;
	const validateOutput = input.options.validateOutput ?? false;
	const scopes = input.options.scopes ?? [{ data: input.data }];
	const collectErrors = input.options.collectErrors ?? false;
	const strictErrors = input.options.strictErrors ?? false;
	const truthinessMode = input.options.truthinessMode ?? "default";

	const trace = debug ? ([] as EvaluationTrace[]) : undefined;
	const caughtErrors = collectErrors ? ([] as CaughtErrorTrace[]) : undefined;

	const ctx: EvaluationContext = {
		operatorRegistry: input.options.operatorRegistry,
		lazy,
		debug,
		depth: 0,
		maxDepth,
		...(trace !== undefined && { trace }),
		scopes,
		...(caughtErrors !== undefined && { caughtErrors }),
		strictErrors,
		truthinessMode,
	};

	return {
		ctx,
		validateArgs,
		validateOutput,
		...(trace !== undefined && { trace }),
		...(caughtErrors !== undefined && { caughtErrors }),
	};
}
