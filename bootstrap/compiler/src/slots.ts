export type ExpressionEvaluatorSlot = {
	evaluate(input: {
		context: unknown;
		expression: unknown;
		expressions?: unknown;
	}): Promise<unknown>;
};
