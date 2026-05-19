import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers is na n.
 *
 * @returns The result produced by `registerIsNaN`.
 *
 * @example
 * registerIsNaN();
 */

export function registerIsNaN(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_nan", {
		handler: (args) => {
			const [value] = args;
			return Number.isNaN(value);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_nan",
			title: "Is NaN",
			description: "Check if value is NaN (Not a Number)",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is NaN",
					input: {},
					rule: { is_nan: [NaN] },
					output: true,
				},
				{
					description: "Value is string NaN",
					input: {},
					rule: { is_nan: ["NaN"] },
					output: false,
				},
				{
					description: "Value is valid number",
					input: {},
					rule: { is_nan: [42] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is finite.
 *
 * @returns The result produced by `registerIsFinite`.
 *
 * @example
 * registerIsFinite();
 */

export function registerIsFinite(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_finite", {
		handler: (args) => {
			const [value] = args;
			return Number.isFinite(value);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_finite",
			title: "Is Finite",
			description: "Check if value is a finite number (not NaN or Infinity)",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is finite number",
					input: {},
					rule: { is_finite: [42] },
					output: true,
				},
				{
					description: "Value is Infinity",
					input: {},
					rule: { is_finite: [Infinity] },
					output: false,
				},
				{
					description: "Value is NaN",
					input: {},
					rule: { is_finite: [NaN] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is integer.
 *
 * @returns The result produced by `registerIsInteger`.
 *
 * @example
 * registerIsInteger();
 */

export function registerIsInteger(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_integer", {
		handler: (args) => {
			const [value] = args;
			return Number.isInteger(value);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_integer",
			title: "Is Integer",
			description: "Check if value is an integer",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is integer",
					input: {},
					rule: { is_integer: [42] },
					output: true,
				},
				{
					description: "Value is float",
					input: {},
					rule: { is_integer: [3.14] },
					output: false,
				},
				{
					description: "Value is not a number",
					input: {},
					rule: { is_integer: ["42"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is float.
 *
 * @returns The result produced by `registerIsFloat`.
 *
 * @example
 * registerIsFloat();
 */

export function registerIsFloat(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_float", {
		handler: (args) => {
			const [value] = args;
			return (
				typeof value === "number" &&
				!Number.isInteger(value) &&
				Number.isFinite(value)
			);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_float",
			title: "Is Float",
			description: "Check if value is a float (has decimal part)",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is float",
					input: {},
					rule: { is_float: [3.14] },
					output: true,
				},
				{
					description: "Value is integer",
					input: {},
					rule: { is_float: [42] },
					output: false,
				},
				{
					description: "Value is not a number",
					input: {},
					rule: { is_float: ["3.14"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is number.
 *
 * @returns The result produced by `registerIsNumber`.
 *
 * @example
 * registerIsNumber();
 */

export function registerIsNumber(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_number", {
		handler: (args) => {
			const [value] = args;
			return typeof value === "number";
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_number",
			title: "Is Number",
			description: "Check if type is number (includes NaN)",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is number",
					input: {},
					rule: { is_number: [42] },
					output: true,
				},
				{
					description: "Value is NaN (typeof NaN is number)",
					input: {},
					rule: { is_number: [NaN] },
					output: true,
				},
				{
					description: "Value is string number",
					input: {},
					rule: { is_number: ["42"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is finite number.
 *
 * @returns The result produced by `registerIsFiniteNumber`.
 *
 * @example
 * registerIsFiniteNumber();
 */

export function registerIsFiniteNumber(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_finite_number", {
		handler: (args) => {
			const [value] = args;
			return typeof value === "number" && Number.isFinite(value);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_finite_number",
			title: "Is Finite Number",
			description:
				"Check if value is a finite number (excludes NaN and Infinity)",
			category: "validation",
			tags: ["validation", "type-check", "number"],
			examples: [
				{
					description: "Value is finite number",
					input: {},
					rule: { is_finite_number: [42] },
					output: true,
				},
				{
					description: "Value is NaN",
					input: {},
					rule: { is_finite_number: [NaN] },
					output: false,
				},
				{
					description: "Value is Infinity",
					input: {},
					rule: { is_finite_number: [Infinity] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
