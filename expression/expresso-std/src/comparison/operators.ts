import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers eq.
 *
 * @returns The result produced by `registerEq`.
 *
 * @example
 * registerEq();
 */

export function registerEq(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("==", {
		handler: ([a, b]) => {
			if (a === b) return true;
			if (a === null || b === null) return false;
			if (typeof a === "number" && typeof b === "number") return false;
			// biome-ignore lint/suspicious/noDoubleEquals: intentional loose equality for == operator
			return a == b;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "==",
			title: "Equals (Loose)",
			description: "Loose equality comparison using ==",
			category: "comparisons",
			tags: ["comparison", "equality", "basic"],
			examples: [
				{
					description: "String equals number (loose)",
					input: {},
					rule: { "==": [1, "1"] },
					output: true,
				},
				{
					description: "Different types but equal value",
					input: {},
					rule: { "==": [true, 1] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers strict eq.
 *
 * @returns The result produced by `registerStrictEq`.
 *
 * @example
 * registerStrictEq();
 */

export function registerStrictEq(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("===", {
		handler: ([a, b]) => a === b,
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "===",
			title: "Equals (Strict)",
			description: "Strict equality comparison using ===",
			category: "comparisons",
			tags: ["comparison", "equality", "basic"],
			examples: [
				{
					description: "String does not strictly equal number",
					input: {},
					rule: { "===": [1, "1"] },
					output: false,
				},
				{
					description: "Same type and value",
					input: {},
					rule: { "===": [1, 1] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers neq.
 *
 * @returns The result produced by `registerNeq`.
 *
 * @example
 * registerNeq();
 */

export function registerNeq(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("!=", {
		handler: ([a, b]) => {
			if (a === b) return false;
			if (a === null || b === null) return true;
			if (typeof a === "number" && typeof b === "number") return true;
			// biome-ignore lint/suspicious/noDoubleEquals: Loose inequality required for JsonLogic compatibility
			return a != b;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!=",
			title: "Not Equals (Loose)",
			description: "Loose inequality comparison using !=",
			category: "comparisons",
			tags: ["comparison", "equality", "basic"],
			examples: [
				{
					description: "String does not loosely equal number",
					input: {},
					rule: { "!=": [1, "2"] },
					output: true,
				},
				{
					description: "Different values",
					input: {},
					rule: { "!=": [1, 2] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers strict neq.
 *
 * @returns The result produced by `registerStrictNeq`.
 *
 * @example
 * registerStrictNeq();
 */

export function registerStrictNeq(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("!==", {
		handler: ([a, b]) => a !== b,
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!==",
			title: "Not Equals (Strict)",
			description: "Strict inequality comparison using !==",
			category: "comparisons",
			tags: ["comparison", "equality", "basic"],
			examples: [
				{
					description: "String strictly not equal to number",
					input: {},
					rule: { "!==": [1, "1"] },
					output: true,
				},
				{
					description: "Different values",
					input: {},
					rule: { "!==": [1, 2] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
