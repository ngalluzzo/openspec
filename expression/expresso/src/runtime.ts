import {
	apply,
	type EvaluationOptions,
	type OperatorRegistry,
	type Rule,
} from "@gooi/expresso-core";
import { getStandardOperatorRegistry } from "./standard.ts";
import { isExpressionEnvelope, unwrapExpression } from "./wire.ts";

export type ExpressoRuntimeOptions = {
	operatorRegistry?: OperatorRegistry;
};

export function createExpressoRuntime(options?: ExpressoRuntimeOptions) {
	const operatorRegistry =
		options?.operatorRegistry ?? getStandardOperatorRegistry();
	const evaluationOptions: EvaluationOptions = { operatorRegistry };

	return {
		evaluate(input: {
			expression: unknown;
			context: unknown;
			expressions?: unknown;
		}): Promise<unknown> {
			const rule: Rule = isExpressionEnvelope(input.expression)
				? unwrapExpression(input.expression)
				: (input.expression as Rule);

			const data =
				input.expressions !== undefined
					? { ...(input.context as object), $expressions: input.expressions }
					: input.context;

			return Promise.resolve(apply(rule, data, evaluationOptions));
		},

		evaluateSync(input: {
			expression: unknown;
			context: unknown;
			expressions?: unknown;
		}): unknown {
			const rule: Rule = isExpressionEnvelope(input.expression)
				? unwrapExpression(input.expression)
				: (input.expression as Rule);

			const data =
				input.expressions !== undefined
					? { ...(input.context as object), $expressions: input.expressions }
					: input.context;

			return apply(rule, data, evaluationOptions);
		},
	};
}
