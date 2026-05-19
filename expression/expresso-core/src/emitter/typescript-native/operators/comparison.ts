import * as ts from "typescript";
import type { JsonValue, Rule } from "../../../runtime/contracts/types";
import { createHelperCall } from "../ast";
import { UnsupportedTypeScriptExpressionError } from "../errors";
import type { TypeScriptNativeOperatorLowerer } from "./shared";

function assertBinaryOperator(
	operator: string,
	args: readonly (Rule | JsonValue)[],
): asserts args is readonly [Rule | JsonValue, Rule | JsonValue] {
	if (args.length !== 2) {
		throw new UnsupportedTypeScriptExpressionError(
			`${operator} requires exactly two arguments`,
		);
	}
}

export const lowerComparisonOperator: TypeScriptNativeOperatorLowerer = (
	operator,
	args,
	context,
	lower,
) => {
	switch (operator) {
		case "==":
			assertBinaryOperator(operator, args);
			return createHelperCall(context, "expressoLooseEqual", [
				lower(args[0], context),
				lower(args[1], context),
			]);

		case "!=":
			assertBinaryOperator(operator, args);
			return createHelperCall(context, "expressoLooseNotEqual", [
				lower(args[0], context),
				lower(args[1], context),
			]);

		case "===":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.EqualsEqualsEqualsToken,
				lower(args[1], context),
			);

		case "!==":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.ExclamationEqualsEqualsToken,
				lower(args[1], context),
			);

		case ">":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.GreaterThanToken,
				lower(args[1], context),
			);

		case ">=":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.GreaterThanEqualsToken,
				lower(args[1], context),
			);

		case "<":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.LessThanToken,
				lower(args[1], context),
			);

		case "<=":
			assertBinaryOperator(operator, args);
			return ts.factory.createBinaryExpression(
				lower(args[0], context),
				ts.SyntaxKind.LessThanEqualsToken,
				lower(args[1], context),
			);

		default:
			return undefined;
	}
};
