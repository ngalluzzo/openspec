import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers contains.
 *
 * @returns The result produced by `registerContains`.
 *
 * @example
 * registerContains();
 */

export function registerContains(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("contains", {
		handler: ([container, substring]) => {
			if (Array.isArray(container)) {
				return container.includes(substring);
			}
			const str = String(container ?? "");
			const sub = String(substring ?? "");
			return str.includes(sub);
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "contains",
			title: "Contains",
			description: "Check if string or array contains value",
			category: "string",
			tags: ["string", "search", "array"],
			examples: [
				{
					description: "Check if string contains substring",
					input: {},
					rule: { contains: ["hello world", "world"] },
					output: true,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers not contains.
 *
 * @returns The result produced by `registerNotContains`.
 *
 * @example
 * registerNotContains();
 */

export function registerNotContains(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("!contains", {
		handler: ([container, substring]) => {
			if (Array.isArray(container)) {
				return !container.includes(substring);
			}
			const str = String(container ?? "");
			const sub = String(substring ?? "");
			return !str.includes(sub);
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!contains",
			title: "Not Contains",
			description: "Check if string or array does not contain value",
			category: "string",
			tags: ["string", "search", "array"],
			examples: [
				{
					description: "Check if string does not contain substring",
					input: {},
					rule: { "!contains": ["hello world", "planet"] },
					output: true,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers in.
 *
 * @returns The result produced by `registerIn`.
 *
 * @example
 * registerIn();
 */

export function registerIn(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("in", {
		handler: ([substring, container]) => {
			if (Array.isArray(container)) {
				return container.includes(substring);
			}

			const str = String(container ?? "");
			const sub = String(substring ?? "");
			return str.includes(sub);
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "in",
			title: "In",
			description: "Check if substring/container includes value",
			category: "string",
			tags: ["string", "search", "array"],
			examples: [
				{
					description: "Check if substring exists in string",
					input: {},
					rule: { in: ["world", "hello world"] },
					output: true,
				},
				{
					description: "Check if value exists in array",
					input: {},
					rule: { in: [2, [1, 2, 3]] },
					output: true,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers is empty.
 *
 * @returns The result produced by `registerIsEmpty`.
 *
 * @example
 * registerIsEmpty();
 */

export function registerIsEmpty(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_empty", {
		handler: (args) => {
			const [value] = args;
			if (value === null || value === undefined) return false;
			if (typeof value === "string") return value.length === 0;
			if (Array.isArray(value)) return value.length === 0;
			return false;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_empty",
			title: "Is Empty",
			description: "Check if empty",
			category: "string",
			tags: ["string", "validation", "array"],
			examples: [
				{
					description: "Check if string is empty",
					input: {},
					rule: { is_empty: [""] },
					output: true,
				},
				{
					description: "Check if string is not empty",
					input: {},
					rule: { is_empty: ["hello"] },
					output: false,
				},
				{
					description: "Check if array is empty",
					input: {},
					rule: { is_empty: [[]] },
					output: true,
				},
				{
					description: "Check if null is empty",
					input: {},
					rule: { is_empty: [null] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers type.
 *
 * @returns The result produced by `registerType`.
 *
 * @example
 * registerType();
 */

export function registerType(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("type", {
		handler: (args) => {
			const [value] = args;
			if (value === null) return "null";
			if (Array.isArray(value)) return "array";
			return typeof value;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "type",
			title: "Type",
			description: "Get type of value",
			category: "string",
			tags: ["utility", "type-check"],
			examples: [
				{
					description: "Get type of string",
					input: {},
					rule: { type: ["hello"] },
					output: "string",
				},
				{
					description: "Get type of number",
					input: {},
					rule: { type: [42] },
					output: "number",
				},
				{
					description: "Get type of array",
					input: {},
					rule: { type: [[1, 2, 3]] },
					output: "array",
				},
				{
					description: "Get type of null",
					input: {},
					rule: { type: [null] },
					output: "null",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
