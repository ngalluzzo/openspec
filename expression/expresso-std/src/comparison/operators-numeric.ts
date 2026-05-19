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
	defineSyncOperator<[number, number], boolean>(">", {
		handler: ([a, b]) => a > b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: ">",
			title: "Greater Than",
			description: "Checks if first value is greater than second",
			category: "comparisons",
			tags: ["comparison", "numeric", "basic"],
			examples: [
				{
					description: "5 > 3",
					input: {},
					rule: { ">": [5, 3] },
					output: true,
				},
				{
					description: "3 > 5",
					input: {},
					rule: { ">": [3, 5] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
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
	defineSyncOperator<[number, number], boolean>(">=", {
		handler: ([a, b]) => a >= b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: ">=",
			title: "Greater Than or Equal",
			description: "Checks if first value is greater than or equal to second",
			category: "comparisons",
			tags: ["comparison", "numeric", "basic"],
			examples: [
				{
					description: "5 >= 5",
					input: {},
					rule: { ">=": [5, 5] },
					output: true,
				},
				{
					description: "3 >= 5",
					input: {},
					rule: { ">=": [3, 5] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
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
	defineSyncOperator<[number, number], boolean>("<", {
		handler: ([a, b]) => a < b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "<",
			title: "Less Than",
			description: "Checks if first value is less than second",
			category: "comparisons",
			tags: ["comparison", "numeric", "basic"],
			examples: [
				{
					description: "3 < 5",
					input: {},
					rule: { "<": [3, 5] },
					output: true,
				},
				{
					description: "5 < 3",
					input: {},
					rule: { "<": [5, 3] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
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
	defineSyncOperator<[number, number], boolean>("<=", {
		handler: ([a, b]) => a <= b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "<=",
			title: "Less Than or Equal",
			description: "Checks if first value is less than or equal to second",
			category: "comparisons",
			tags: ["comparison", "numeric", "basic"],
			examples: [
				{
					description: "5 <= 5",
					input: {},
					rule: { "<=": [5, 5] },
					output: true,
				},
				{
					description: "5 <= 3",
					input: {},
					rule: { "<=": [5, 3] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
