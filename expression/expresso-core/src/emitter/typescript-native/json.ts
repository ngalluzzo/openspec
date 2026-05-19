import * as ts from "typescript";
import type {
	DataMarker,
	JsonValue,
	Rule,
} from "../../runtime/contracts/types";
import { UnsupportedTypeScriptExpressionError } from "./errors";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDataMarker(value: unknown): value is DataMarker {
	return isRecord(value) && Object.keys(value).length === 1 && "@data" in value;
}

export function isJsonValue(value: unknown): value is JsonValue {
	if (value === null) {
		return true;
	}

	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return true;
	}

	if (Array.isArray(value)) {
		return value.every((item) => isJsonValue(item));
	}

	if (isRecord(value)) {
		return Object.values(value).every((entry) => isJsonValue(entry));
	}

	return false;
}

export function isRuleArray(value: unknown): value is readonly Rule[] {
	return Array.isArray(value);
}

export function isOperatorRule(
	value: unknown,
): value is Readonly<Record<string, Rule | readonly Rule[] | JsonValue>> {
	return (
		isRecord(value) && !isDataMarker(value) && Object.keys(value).length === 1
	);
}

export function toOperatorArgs(
	value: Rule | readonly Rule[] | JsonValue,
): readonly (Rule | JsonValue)[] {
	return Array.isArray(value) ? value : [value];
}

export function lowerJsonLiteral(value: JsonValue): ts.Expression {
	if (value === null) {
		return ts.factory.createNull();
	}

	if (typeof value === "string") {
		return ts.factory.createStringLiteral(value);
	}

	if (typeof value === "number") {
		if (!Number.isFinite(value)) {
			throw new UnsupportedTypeScriptExpressionError(
				"Non-finite numeric literals are not supported in native TypeScript emission",
			);
		}

		return value < 0
			? ts.factory.createPrefixUnaryExpression(
					ts.SyntaxKind.MinusToken,
					ts.factory.createNumericLiteral(Math.abs(value)),
				)
			: ts.factory.createNumericLiteral(value);
	}

	if (typeof value === "boolean") {
		return value ? ts.factory.createTrue() : ts.factory.createFalse();
	}

	if (Array.isArray(value)) {
		return ts.factory.createArrayLiteralExpression(
			value.map((item) => lowerJsonLiteral(item)),
			false,
		);
	}

	return ts.factory.createObjectLiteralExpression(
		Object.entries(value).map(([key, entryValue]) =>
			ts.factory.createPropertyAssignment(key, lowerJsonLiteral(entryValue)),
		),
		false,
	);
}
