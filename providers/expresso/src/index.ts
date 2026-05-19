import {
	createExpressoRuntime,
	type ExpressoRuntimeOptions,
} from "@gooi/expresso";
import {
	type ExpressExpressionEvaluateImplementation,
	implementExpressionEvaluateAdapter,
} from "./sdk/expression-evaluate.generated.ts";

export type { ExpressExpressionEvaluateImplementation };
export { implementExpressionEvaluateAdapter };

export function createExpressExpressionEvaluateAdapter(
	options?: ExpressoRuntimeOptions,
): ExpressExpressionEvaluateImplementation {
	return implementExpressionEvaluateAdapter(createExpressoRuntime(options));
}

export const expressExpressionEvaluateAdapter =
	createExpressExpressionEvaluateAdapter();
