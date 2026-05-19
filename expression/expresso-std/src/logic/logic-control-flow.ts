import { defineSyncOperator, evaluate, isTruthy } from "@gooi/expresso-core";
import type {
	EvaluationContext,
	OperatorRegistry,
	Rule,
} from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers if.
 *
 * @returns The result produced by `registerIf`.
 *
 * @example
 * registerIf();
 */

export function registerIf(operatorRegistry: OperatorRegistry) {
	const register = defineSyncOperator<unknown[], unknown>("if", {
		handler: ([...args], data, ctx: EvaluationContext) => {
			for (let i = 0; i < args.length - 1; i += 2) {
				const condition = evaluate(args[i] as Rule, data, ctx, false, false);
				if (isTruthy(condition, ctx.truthinessMode)) {
					return evaluate(args[i + 1] as Rule, data, ctx, false, false);
				}
			}
			return evaluate(args[args.length - 1] as Rule, data, ctx, false, false);
		},
		inputSchema: z.array(z.any()).min(3),
		outputSchema: z.any(),
		metadata: {
			name: "if",
			title: "If",
			description:
				"Conditional operator - supports if/then/elseif/then/.../else pattern. Returns the first then value whose condition is truthy, or final else value.",
			category: "logic",
			tags: ["control-flow", "conditional", "basic"],
			preserveRules: true,
			examples: [
				{
					description: "True condition",
					input: {},
					rule: { if: [true, "yes", "no"] },
					output: "yes",
				},
				{
					description: "False condition",
					input: {},
					rule: { if: [false, "yes", "no"] },
					output: "no",
				},
				{
					description: "Multiple conditions (if/elseif/else)",
					input: { temp: 55 },
					rule: {
						if: [
							{ "<": [{ var: "temp" }, 0] },
							"freezing",
							{ "<": [{ var: "temp" }, 100] },
							"liquid",
							"gas",
						],
					},
					output: "liquid",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	});
	register(operatorRegistry);
}

/**
 * Registers switch.
 *
 * @returns The result produced by `registerSwitch`.
 *
 * @example
 * registerSwitch();
 */

export function registerSwitch(operatorRegistry: OperatorRegistry) {
	const register = defineSyncOperator<unknown[], unknown>("switch", {
		handler: ([...args], data, ctx: EvaluationContext) => {
			for (let i = 0; i < args.length - 1; i += 2) {
				const condition = evaluate(args[i] as Rule, data, ctx, false, false);
				if (isTruthy(condition, ctx.truthinessMode)) {
					return evaluate(args[i + 1] as Rule, data, ctx, false, false);
				}
			}
			return evaluate(args[args.length - 1] as Rule, data, ctx, false, false);
		},
		inputSchema: z.array(z.any()).min(3),
		outputSchema: z.any(),
		eager: true,
		metadata: {
			name: "switch",
			title: "Switch",
			description: "Switch/case operator with fall-through default",
			category: "logic",
			tags: ["control-flow", "conditional"],
			examples: [
				{
					description: "First matching case",
					input: { value: 2 },
					rule: {
						switch: [
							{ "==": [{ var: "value" }, 1] },
							"one",
							{ "==": [{ var: "value" }, 2] },
							"two",
							"other",
						],
					},
					output: "two",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	});
	register(operatorRegistry);
}

/**
 * Registers ternary.
 *
 * @returns The result produced by `registerTernary`.
 *
 * @example
 * registerTernary();
 */

export function registerTernary(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown, unknown], unknown>("ternary", {
		handler: ([condition, thenValue, elseValue]) => {
			return condition ? thenValue : elseValue;
		},
		inputSchema: z.tuple([z.any(), z.any(), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "ternary",
			title: "Ternary",
			description: "Ternary operator (condition ? then : else)",
			category: "logic",
			tags: ["control-flow", "conditional"],
			examples: [
				{
					description: "True condition",
					input: {},
					rule: { ternary: [true, "yes", "no"] },
					output: "yes",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers coalesce.
 *
 * @returns The result produced by `registerCoalesce`.
 *
 * @example
 * registerCoalesce();
 */

export function registerCoalesce(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("coalesce", {
		handler: ([...values]) => {
			for (const value of values) {
				if (value !== null && value !== undefined) {
					return value;
				}
			}
			return values[values.length - 1];
		},
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.any(),
		metadata: {
			name: "coalesce",
			title: "Coalesce",
			description: "Returns first non-null/undefined value",
			category: "logic",
			tags: ["logic", "null-handling"],
			examples: [
				{
					description: "First non-null value",
					input: {},
					rule: { coalesce: [null, null, "default", "other"] },
					output: "default",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers default.
 *
 * @returns The result produced by `registerDefault`.
 *
 * @example
 * registerDefault();
 */

export function registerDefault(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], unknown>("default", {
		handler: ([value, defaultValue]) => {
			return value !== null && value !== undefined ? value : defaultValue;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "default",
			title: "Default",
			description: "Returns value or default if null/undefined",
			category: "logic",
			tags: ["logic", "null-handling"],
			examples: [
				{
					description: "Value is null, return default",
					input: {},
					rule: { default: [null, "default"] },
					output: "default",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
