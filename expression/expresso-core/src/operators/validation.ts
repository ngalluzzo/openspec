import { z } from "zod";
import type { JsonValue, Rule } from "../runtime/contracts/types";
import type { OperatorRegistry } from "./registry";

const primitiveSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null(),
]);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(
	() =>
		z.union([
			primitiveSchema,
			z.array(jsonValueSchema),
			z.record(z.string(), jsonValueSchema),
		]) as z.ZodType<JsonValue>,
);

const arraySchema = z.array(jsonValueSchema);

const objectSchema = z.record(z.string(), jsonValueSchema);

export const ruleSchema = z.union([
	primitiveSchema,
	arraySchema,
	objectSchema,
]) as z.ZodType<Rule>;

/**
 * Validates rule.
 *
 * @param rule - The `rule` argument value.
 *
 * @returns The result produced by `validateRule`.
 *
 * @example
 * validateRule(rule);
 */

export function validateRule(rule: unknown): rule is Rule {
	return ruleSchema.safeParse(rule).success;
}

/**
 * Parses rule.
 *
 * @param rule - The `rule` argument value.
 *
 * @returns The result produced by `parseRule`.
 *
 * @example
 * parseRule(rule);
 */

export function parseRule(rule: unknown): Rule {
	return ruleSchema.parse(rule);
}

/**
 * Validates operator args.
 *
 * @param operator - The `operator` argument value.
 * @param args - Ordered argument values for the operation.
 *
 * @returns The result produced by `validateOperatorArgs`.
 *
 * @example
 * validateOperatorArgs(operator, args);
 */

export function validateOperatorArgs(
	operatorRegistry: OperatorRegistry,
	operator: string,
	args: unknown,
): boolean {
	const schema = operatorRegistry.getSchema(operator);
	if (!schema?.input) {
		return true;
	}

	return schema.input.safeParse(args).success;
}
