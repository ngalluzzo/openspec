import * as ts from "typescript";
import { createHelperCall } from "../ast";
import { UnsupportedTypeScriptExpressionError } from "../errors";
import type { TypeScriptNativeOperatorLowerer } from "./shared";

export const lowerCollectionOperator: TypeScriptNativeOperatorLowerer = (
	operator,
	args,
	context,
	lower,
) => {
	switch (operator) {
		case "merge":
			if (args.length === 0) {
				throw new UnsupportedTypeScriptExpressionError(
					"merge requires at least one argument",
				);
			}

			return createHelperCall(context, "mergeArrayValues", [
				ts.factory.createArrayLiteralExpression(
					args.map((arg) => lower(arg, context)),
					false,
				),
			]);

		case "merge_deep":
			if (args.length < 2) {
				throw new UnsupportedTypeScriptExpressionError(
					"merge_deep requires at least two arguments",
				);
			}

			return createHelperCall(context, "mergeDeepValues", [
				ts.factory.createArrayLiteralExpression(
					args.map((arg) => lower(arg, context)),
					false,
				),
			]);

		default:
			return undefined;
	}
};
