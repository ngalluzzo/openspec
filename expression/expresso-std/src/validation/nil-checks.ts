import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers is null.
 *
 * @returns The result produced by `registerIsNull`.
 *
 * @example
 * registerIsNull();
 */

export function registerIsNull(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_null", {
		handler: (args) => {
			const [value] = args;
			return value === null;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_null",
			title: "Is Null",
			description: "Check if value is exactly null",
			category: "validation",
			tags: ["validation", "type-check", "null"],
			examples: [
				{
					description: "Value is null",
					input: {},
					rule: { is_null: [null] },
					output: true,
				},
				{
					description: "Value is zero",
					input: {},
					rule: { is_null: [0] },
					output: false,
				},
				{
					description: "Value is empty string",
					input: {},
					rule: { is_null: [""] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is undefined.
 *
 * @returns The result produced by `registerIsUndefined`.
 *
 * @example
 * registerIsUndefined();
 */

export function registerIsUndefined(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_undefined", {
		handler: (args) => {
			const [value] = args;
			return value === undefined;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_undefined",
			title: "Is Undefined",
			description: "Check if value is exactly undefined",
			category: "validation",
			tags: ["validation", "type-check", "undefined"],
			examples: [
				{
					description: "Value is null (not undefined)",
					input: {},
					rule: { is_undefined: [null] },
					output: false,
				},
				{
					description: "Value is empty string",
					input: {},
					rule: { is_undefined: [""] },
					output: false,
				},
				{
					description: "Value is number",
					input: {},
					rule: { is_undefined: [0] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is nil.
 *
 * @returns The result produced by `registerIsNil`.
 *
 * @example
 * registerIsNil();
 */

export function registerIsNil(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_nil", {
		handler: (args) => {
			const [value] = args;
			return value === null || value === undefined;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_nil",
			title: "Is Nil",
			description: "Check if value is null or undefined",
			category: "validation",
			tags: ["validation", "type-check", "null", "undefined"],
			examples: [
				{
					description: "Value is null",
					input: {},
					rule: { is_nil: [null] },
					output: true,
				},
				{
					description: "Value is zero",
					input: {},
					rule: { is_nil: [0] },
					output: false,
				},
				{
					description: "Value is empty string",
					input: {},
					rule: { is_nil: [""] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
