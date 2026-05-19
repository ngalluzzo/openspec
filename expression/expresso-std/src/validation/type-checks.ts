import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers is string.
 *
 * @returns The result produced by `registerIsString`.
 *
 * @example
 * registerIsString();
 */

export function registerIsString(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_string", {
		handler: (args) => {
			const [value] = args;
			return typeof value === "string";
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_string",
			title: "Is String",
			description: "Check if type is string",
			category: "validation",
			tags: ["validation", "type-check", "string"],
			examples: [
				{
					description: "Value is string",
					input: {},
					rule: { is_string: ["hello"] },
					output: true,
				},
				{
					description: "Value is number",
					input: {},
					rule: { is_string: [42] },
					output: false,
				},
				{
					description: "Value is empty string",
					input: {},
					rule: { is_string: [""] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is boolean.
 *
 * @returns The result produced by `registerIsBoolean`.
 *
 * @example
 * registerIsBoolean();
 */

export function registerIsBoolean(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_boolean", {
		handler: (args) => {
			const [value] = args;
			return typeof value === "boolean";
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_boolean",
			title: "Is Boolean",
			description: "Check if type is boolean",
			category: "validation",
			tags: ["validation", "type-check", "boolean"],
			examples: [
				{
					description: "Value is boolean true",
					input: {},
					rule: { is_boolean: [true] },
					output: true,
				},
				{
					description: "Value is boolean false",
					input: {},
					rule: { is_boolean: [false] },
					output: true,
				},
				{
					description: "Value is truthy number",
					input: {},
					rule: { is_boolean: [1] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is array.
 *
 * @returns The result produced by `registerIsArray`.
 *
 * @example
 * registerIsArray();
 */

export function registerIsArray(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_array", {
		handler: (args) => {
			const [value] = args;
			return Array.isArray(value);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_array",
			title: "Is Array",
			description: "Check if value is an array",
			category: "validation",
			tags: ["validation", "type-check", "array"],
			examples: [
				{
					description: "Value is array",
					input: {},
					rule: { is_array: [[1, 2, 3]] },
					output: true,
				},
				{
					description: "Value is empty array",
					input: {},
					rule: { is_array: [[]] },
					output: true,
				},
				{
					description: "Value is not array",
					input: {},
					rule: { is_array: ["not array"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is object.
 *
 * @returns The result produced by `registerIsObject`.
 *
 * @example
 * registerIsObject();
 */

export function registerIsObject(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_object", {
		handler: (args) => {
			const [value] = args;
			return (
				value !== null && typeof value === "object" && !Array.isArray(value)
			);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_object",
			title: "Is Object",
			description: "Check if value is a plain object (not null, not array)",
			category: "validation",
			tags: ["validation", "type-check", "object"],
			examples: [
				{
					description: "Value is array",
					input: {},
					rule: { is_object: [[1, 2, 3]] },
					output: false,
				},
				{
					description: "Value is null",
					input: {},
					rule: { is_object: [null] },
					output: false,
				},
				{
					description: "Value is string",
					input: {},
					rule: { is_object: ["not object"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
