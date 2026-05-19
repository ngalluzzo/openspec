import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers required.
 *
 * @returns The result produced by `registerRequired`.
 *
 * @example
 * registerRequired();
 */

export function registerRequired(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("required", {
		handler: (args) => {
			const [value] = args;
			if (value === null || value === undefined) return false;
			if (typeof value === "string" && value.trim() === "") return false;
			return true;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "required",
			title: "Required",
			description: "Check if value is present and not empty",
			category: "validation",
			tags: ["validation", "required"],
			examples: [
				{
					description: "Value is present",
					input: {},
					rule: { required: ["hello"] },
					output: true,
				},
				{
					description: "Value is empty string",
					input: {},
					rule: { required: [""] },
					output: false,
				},
				{
					description: "Value is null",
					input: {},
					rule: { required: [null] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers matches.
 *
 * @returns The result produced by `registerMatches`.
 *
 * @example
 * registerMatches();
 */

export function registerMatches(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("matches", {
		handler: (args) => {
			const [value, otherValue] = args;
			return value === otherValue;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "matches",
			title: "Matches",
			description:
				"Check if value matches another value (for cross-field validation)",
			category: "validation",
			tags: ["validation", "comparison", "cross-field"],
			examples: [
				{
					description: "Values match",
					input: {},
					rule: { matches: ["password123", "password123"] },
					output: true,
				},
				{
					description: "Values do not match",
					input: {},
					rule: { matches: ["password123", "different"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
