import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers greater than.
 *
 * @returns The result produced by `registerGreaterThan`.
 *
 * @example
 * registerGreaterThan();
 */

export function registerGreaterThan(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], boolean>("greater-than", {
		handler: ([a, b]) => a > b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "greater-than",
			title: "Greater Than",
			description: "Checks if first number is greater than second",
			category: "numeric",
			tags: ["comparison", "basic"],
			aliases: [">"],
			examples: [
				{
					description: "5 > 3",
					input: {},
					rule: { "greater-than": [5, 3] },
					output: true,
				},
				{
					description: "3 > 5",
					input: {},
					rule: { "greater-than": [3, 5] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers greater equal.
 *
 * @returns The result produced by `registerGreaterEqual`.
 *
 * @example
 * registerGreaterEqual();
 */

export function registerGreaterEqual(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], boolean>("greater-equal", {
		handler: ([a, b]) => a >= b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "greater-equal",
			title: "Greater Than or Equal",
			description: "Checks if first number is greater than or equal to second",
			category: "numeric",
			tags: ["comparison", "basic"],
			aliases: [">="],
			examples: [
				{
					description: "5 >= 5",
					input: {},
					rule: { "greater-equal": [5, 5] },
					output: true,
				},
				{
					description: "3 >= 5",
					input: {},
					rule: { "greater-equal": [3, 5] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers less than.
 *
 * @returns The result produced by `registerLessThan`.
 *
 * @example
 * registerLessThan();
 */

export function registerLessThan(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], boolean>("less-than", {
		handler: ([a, b]) => a < b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "less-than",
			title: "Less Than",
			description: "Checks if first number is less than second",
			category: "numeric",
			tags: ["comparison", "basic"],
			aliases: ["<"],
			examples: [
				{
					description: "3 < 5",
					input: {},
					rule: { "less-than": [3, 5] },
					output: true,
				},
				{
					description: "5 < 3",
					input: {},
					rule: { "less-than": [5, 3] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers less equal.
 *
 * @returns The result produced by `registerLessEqual`.
 *
 * @example
 * registerLessEqual();
 */

export function registerLessEqual(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], boolean>("less-equal", {
		handler: ([a, b]) => a <= b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "less-equal",
			title: "Less Than or Equal",
			description: "Checks if first number is less than or equal to second",
			category: "numeric",
			tags: ["comparison", "basic"],
			aliases: ["<="],
			examples: [
				{
					description: "5 <= 5",
					input: {},
					rule: { "less-equal": [5, 5] },
					output: true,
				},
				{
					description: "5 <= 3",
					input: {},
					rule: { "less-equal": [5, 3] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers between.
 *
 * @returns The result produced by `registerBetween`.
 *
 * @example
 * registerBetween();
 */

export function registerBetween(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number, number], boolean>("between", {
		handler: ([min, value, max]) => value >= min && value <= max,
		inputSchema: z.tuple([z.number(), z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "between",
			title: "Between",
			description: "Checks if value is between min and max (inclusive)",
			category: "numeric",
			tags: ["comparison", "range"],
			examples: [
				{
					description: "5 between 0 and 10",
					input: {},
					rule: { between: [0, 5, 10] },
					output: true,
				},
				{
					description: "15 between 0 and 10",
					input: {},
					rule: { between: [0, 15, 10] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
