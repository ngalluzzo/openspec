import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers min length.
 *
 * @returns The result produced by `registerMinLength`.
 *
 * @example
 * registerMinLength();
 */

export function registerMinLength(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("min_length", {
		handler: (args) => {
			const [value, min] = args;
			const length =
				typeof value === "string"
					? value.length
					: Array.isArray(value)
						? value.length
						: 0;
			return length >= min;
		},
		inputSchema: z.tuple([z.any(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "min_length",
			title: "Min Length",
			description: "Check if string or array has minimum length",
			category: "validation",
			tags: ["validation", "range", "string", "array"],
			examples: [
				{
					description: "String meets minimum length",
					input: {},
					rule: { min_length: ["hello world", 5] },
					output: true,
				},
				{
					description: "String fails minimum length",
					input: {},
					rule: { min_length: ["abc", 5] },
					output: false,
				},
				{
					description: "Array meets minimum length",
					input: {},
					rule: { min_length: [[1, 2, 3, 4, 5], 3] },
					output: true,
				},
				{
					description: "Empty string fails",
					input: {},
					rule: { min_length: ["", 1] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers max length.
 *
 * @returns The result produced by `registerMaxLength`.
 *
 * @example
 * registerMaxLength();
 */

export function registerMaxLength(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("max_length", {
		handler: (args) => {
			const [value, max] = args;
			const length =
				typeof value === "string"
					? value.length
					: Array.isArray(value)
						? value.length
						: 0;
			return length <= max;
		},
		inputSchema: z.tuple([z.any(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "max_length",
			title: "Max Length",
			description: "Check if string or array has maximum length",
			category: "validation",
			tags: ["validation", "range", "string", "array"],
			examples: [
				{
					description: "String meets maximum length",
					input: {},
					rule: { max_length: ["hello", 10] },
					output: true,
				},
				{
					description: "String exceeds maximum length",
					input: {},
					rule: { max_length: ["very long string", 5] },
					output: false,
				},
				{
					description: "Array meets maximum length",
					input: {},
					rule: { max_length: [[1, 2, 3], 5] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers equals length.
 *
 * @returns The result produced by `registerEqualsLength`.
 *
 * @example
 * registerEqualsLength();
 */

export function registerEqualsLength(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("equals_length", {
		handler: (args) => {
			const [value, length] = args;
			const valueLength =
				typeof value === "string"
					? value.length
					: Array.isArray(value)
						? value.length
						: 0;
			return valueLength === length;
		},
		inputSchema: z.tuple([z.any(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "equals_length",
			title: "Equals Length",
			description: "Check if string or array has exact length",
			category: "validation",
			tags: ["validation", "range", "string", "array"],
			examples: [
				{
					description: "String has exact length",
					input: {},
					rule: { equals_length: ["hello", 5] },
					output: true,
				},
				{
					description: "String has wrong length",
					input: {},
					rule: { equals_length: ["world", 3] },
					output: false,
				},
				{
					description: "Array has exact length",
					input: {},
					rule: { equals_length: [[1, 2, 3], 3] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers between length.
 *
 * @returns The result produced by `registerBetweenLength`.
 *
 * @example
 * registerBetweenLength();
 */

export function registerBetweenLength(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("between_length", {
		handler: (args) => {
			const [value, min, max] = args;
			const length =
				typeof value === "string"
					? value.length
					: Array.isArray(value)
						? value.length
						: 0;
			return length >= min && length <= max;
		},
		inputSchema: z.tuple([z.any(), z.number(), z.number()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "between_length",
			title: "Between Length",
			description: "Check if string or array length is within range",
			category: "validation",
			tags: ["validation", "range", "string", "array"],
			examples: [
				{
					description: "String length within range",
					input: {},
					rule: { between_length: ["hello", 3, 6] },
					output: true,
				},
				{
					description: "String length below range",
					input: {},
					rule: { between_length: ["hi", 3, 6] },
					output: false,
				},
				{
					description: "Array length within range",
					input: {},
					rule: { between_length: [[1, 2, 3, 4], 2, 5] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
