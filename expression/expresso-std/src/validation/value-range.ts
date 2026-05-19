import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers range.
 *
 * @returns The result produced by `registerRange`.
 *
 * @example
 * registerRange();
 */

export function registerRange(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("range", {
		handler: (args) => {
			const [value, min, max] = args;
			if (typeof value !== "number") return false;
			return value >= min && value <= max;
		},
		inputSchema: z.tuple([z.number(), z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "range",
			title: "Range",
			description: "Check if number is within inclusive range",
			category: "validation",
			tags: ["validation", "range", "number"],
			examples: [
				{
					description: "Number within range",
					input: {},
					rule: { range: [5, 1, 10] },
					output: true,
				},
				{
					description: "Number below range",
					input: {},
					rule: { range: [0, 1, 10] },
					output: false,
				},
				{
					description: "Number above range",
					input: {},
					rule: { range: [15, 1, 10] },
					output: false,
				},
				{
					description: "Number at boundary",
					input: {},
					rule: { range: [10, 1, 10] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers in range.
 *
 * @returns The result produced by `registerInRange`.
 *
 * @example
 * registerInRange();
 */

export function registerInRange(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("in_range", {
		handler: (args) => {
			const [value, min, max] = args;
			if (typeof value !== "number") return false;
			return value >= min && value <= max;
		},
		inputSchema: z.tuple([z.number(), z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "in_range",
			title: "In Range",
			description:
				"Check if number is within inclusive range (alias for range)",
			category: "validation",
			tags: ["validation", "range", "number"],
			examples: [
				{
					description: "Number within range",
					input: {},
					rule: { in_range: [5, 1, 10] },
					output: true,
				},
				{
					description: "Number below range",
					input: {},
					rule: { in_range: [0, 1, 10] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers min value.
 *
 * @returns The result produced by `registerMinValue`.
 *
 * @example
 * registerMinValue();
 */

export function registerMinValue(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("min_value", {
		handler: (args) => {
			const [value, min] = args;
			if (typeof value !== "number") return false;
			return value >= min;
		},
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "min_value",
			title: "Min Value",
			description: "Check if value is greater than or equal to minimum",
			category: "validation",
			tags: ["validation", "range", "number"],
			examples: [
				{
					description: "Value meets minimum",
					input: {},
					rule: { min_value: [5, 3] },
					output: true,
				},
				{
					description: "Value below minimum",
					input: {},
					rule: { min_value: [2, 3] },
					output: false,
				},
				{
					description: "Value equals minimum",
					input: {},
					rule: { min_value: [3, 3] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers max value.
 *
 * @returns The result produced by `registerMaxValue`.
 *
 * @example
 * registerMaxValue();
 */

export function registerMaxValue(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("max_value", {
		handler: (args) => {
			const [value, max] = args;
			if (typeof value !== "number") return false;
			return value <= max;
		},
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "max_value",
			title: "Max Value",
			description: "Check if value is less than or equal to maximum",
			category: "validation",
			tags: ["validation", "range", "number"],
			examples: [
				{
					description: "Value meets maximum",
					input: {},
					rule: { max_value: [5, 10] },
					output: true,
				},
				{
					description: "Value exceeds maximum",
					input: {},
					rule: { max_value: [15, 10] },
					output: false,
				},
				{
					description: "Value equals maximum",
					input: {},
					rule: { max_value: [10, 10] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
