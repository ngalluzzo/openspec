import * as ts from "typescript";
import type { JsonValue, Rule } from "../../runtime/contracts/types";
import type { TypeScriptNativeEmitterContext } from "./contracts";
import { UnsupportedTypeScriptExpressionError } from "./errors";
import {
	isDataMarker,
	isJsonValue,
	isOperatorRule,
	isRuleArray,
	lowerJsonLiteral,
	toOperatorArgs,
} from "./json";
import { lowerAccessOperator } from "./operators/access";
import { lowerCollectionOperator } from "./operators/collection";
import { lowerComparisonOperator } from "./operators/comparison";
import { lowerLogicOperator } from "./operators/logic";
import { lowerStringOperator } from "./operators/string";

const TYPE_SCRIPT_NATIVE_OPERATOR_LOWERERS = Object.freeze([
	lowerAccessOperator,
	lowerStringOperator,
	lowerLogicOperator,
	lowerComparisonOperator,
	lowerCollectionOperator,
]);

export function lowerTypeScriptNativeExpression(
	rule: Rule | JsonValue,
	context: TypeScriptNativeEmitterContext,
): ts.Expression {
	if (rule === null) {
		return ts.factory.createNull();
	}

	if (
		typeof rule === "string" ||
		typeof rule === "number" ||
		typeof rule === "boolean"
	) {
		return lowerJsonLiteral(rule);
	}

	if (isRuleArray(rule)) {
		return ts.factory.createArrayLiteralExpression(
			rule.map((entry) => lowerTypeScriptNativeExpression(entry, context)),
			false,
		);
	}

	if (isDataMarker(rule)) {
		const dataValue = rule["@data"];
		if (!isJsonValue(dataValue)) {
			throw new UnsupportedTypeScriptExpressionError(
				"@data markers must contain JSON-compatible literal values for native TypeScript emission",
			);
		}

		return lowerJsonLiteral(dataValue);
	}

	if (!isOperatorRule(rule)) {
		throw new UnsupportedTypeScriptExpressionError(
			"Plain object literals must be wrapped in @data for native TypeScript emission",
		);
	}

	const [operator, rawArgs] = Object.entries(rule)[0] as [
		string,
		Rule | readonly Rule[] | JsonValue,
	];
	const args = toOperatorArgs(rawArgs);

	for (const lowerOperator of TYPE_SCRIPT_NATIVE_OPERATOR_LOWERERS) {
		const lowered = lowerOperator(
			operator,
			args,
			context,
			lowerTypeScriptNativeExpression,
		);
		if (lowered !== undefined) {
			return lowered;
		}
	}

	throw new UnsupportedTypeScriptExpressionError(
		`Operator "${operator}" is not yet supported by the native TypeScript emitter`,
	);
}
