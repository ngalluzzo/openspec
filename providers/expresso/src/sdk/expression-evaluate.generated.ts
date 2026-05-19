import * as ModelTypes from "./expression-evaluate-types.generated";

export type ExpressionEvaluateAdapter = { evaluate: (input: ModelTypes.ExpressionEvaluateInput) => Promise<ModelTypes.ExpressionEvaluateResult>; };

export type ExpressionEvaluateAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ExpressionEvaluateAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const expressionEvaluateAdapterContract: ExpressionEvaluateAdapterContract = { capability: "expression.evaluate", methods: [{ name: "evaluate", guards: [] }] };

export function implementExpressionEvaluateAdapter(adapter: ExpressionEvaluateAdapter): ExpressionEvaluateAdapter {
	return adapter;
}

export type ExpressExpressionEvaluateImplementation = ExpressionEvaluateAdapter;
