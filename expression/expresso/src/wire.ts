import { parseRule, validateRule, type Rule } from "@gooi/expresso-core";

export type ExpressoExpressionEnvelope = {
	readonly $expr: Rule;
};

export function expression(rule: Rule): ExpressoExpressionEnvelope {
	return { $expr: rule };
}

export function isExpressionEnvelope(
	value: unknown,
): value is ExpressoExpressionEnvelope {
	return (
		value !== null &&
		typeof value === "object" &&
		!Array.isArray(value) &&
		Object.keys(value).length === 1 &&
		validateRule(normalizeRuleValue((value as { $expr?: unknown }).$expr))
	);
}

export function parseExpressionEnvelope(
	value: unknown,
): ExpressoExpressionEnvelope {
	if (isExpressionEnvelope(value)) {
		return value;
	}

	if (
		value === null ||
		typeof value !== "object" ||
		Array.isArray(value) ||
		Object.keys(value).length !== 1 ||
		!("$expr" in value)
	) {
		throw new Error(
			"Expected an Expresso expression envelope with a single $expr rule.",
		);
	}

	return {
		$expr: parseRule(normalizeRuleValue((value as { $expr: unknown }).$expr)),
	};
}

export function unwrapExpression(value: ExpressoExpressionEnvelope): Rule {
	return value.$expr;
}

export function toExpressionEnvelope(
	value: unknown,
): ExpressoExpressionEnvelope {
	if (isExpressionEnvelope(value)) {
		return value;
	}

	if (validateRule(value)) {
		return expression(value);
	}

	return expression(parseRule(normalizeRuleValue(value)));
}

function normalizeRuleValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeRuleValue(entry));
	}

	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				normalizeRuleValue(entry),
			]),
		);
	}

	return value;
}
