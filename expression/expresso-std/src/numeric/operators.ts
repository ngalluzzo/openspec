import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers plus.
 *
 * @returns The result produced by `registerPlus`.
 *
 * @example
 * registerPlus();
 */

export function registerPlus(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<number[], number>("plus", {
		handler: ([...values]) => values.reduce((sum, val) => sum + val, 0),
		inputSchema: z.array(z.number()).min(1),
		outputSchema: z.number(),
		metadata: {
			name: "plus",
			title: "Addition (Plus)",
			description: "Adds multiple numbers together",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			aliases: ["+"],
			examples: [
				{
					description: "5 + 3 + 2",
					input: {},
					rule: { plus: [5, 3, 2] },
					output: 10,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers minus.
 *
 * @returns The result produced by `registerMinus`.
 *
 * @example
 * registerMinus();
 */

export function registerMinus(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], number>("minus", {
		handler: ([a, b]) => a - b,
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.number(),
		metadata: {
			name: "minus",
			title: "Subtraction (Minus)",
			description: "Subtracts second number from first",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			examples: [
				{
					description: "5 - 3",
					input: {},
					rule: { minus: [5, 3] },
					output: 2,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
			aliases: ["-"],
		},
	})(operatorRegistry);
}

/**
 * Registers multiply.
 *
 * @returns The result produced by `registerMultiply`.
 *
 * @example
 * registerMultiply();
 */

export function registerMultiply(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<number[], number>("multiply", {
		handler: ([...values]) => values.reduce((product, val) => product * val, 1),
		inputSchema: z.array(z.number()).min(1),
		outputSchema: z.number(),
		metadata: {
			name: "multiply",
			title: "Multiplication",
			description: "Multiplies multiple numbers together",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			examples: [
				{
					description: "5 * 3",
					input: {},
					rule: { multiply: [5, 3] },
					output: 15,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			aliases: ["*"],
		},
	})(operatorRegistry);
}

/**
 * Registers divide.
 *
 * @returns The result produced by `registerDivide`.
 *
 * @example
 * registerDivide();
 */

export function registerDivide(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], number>("divide", {
		handler: ([a, b]) => {
			if (b === 0) {
				throw new Error("Division by zero");
			}
			return a / b;
		},
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.number(),
		metadata: {
			name: "divide",
			title: "Division",
			description: "Divides first number by second",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			examples: [
				{
					description: "10 / 2",
					input: {},
					rule: { divide: [10, 2] },
					output: 5,
				},
			],
			complexity: "O(1)",
			performanceNotes: "Checks for division by zero",
			jsonlogicCompatible: false,
			aliases: ["/"],
		},
	})(operatorRegistry);
}

/**
 * Registers modulo.
 *
 * @returns The result produced by `registerModulo`.
 *
 * @example
 * registerModulo();
 */

export function registerModulo(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number, number], number>("modulo", {
		handler: ([a, b]) => {
			if (b === 0) {
				throw new Error("Modulo by zero");
			}
			return a % b;
		},
		inputSchema: z.tuple([z.number(), z.number()]),
		outputSchema: z.number(),
		metadata: {
			name: "modulo",
			title: "Modulo",
			description: "Returns the remainder of division",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			examples: [
				{
					description: "10 % 3",
					input: {},
					rule: { modulo: [10, 3] },
					output: 1,
				},
			],
			complexity: "O(1)",
			performanceNotes: "Checks for modulo by zero",
			jsonlogicCompatible: false,
			aliases: ["%"],
		},
	})(operatorRegistry);
}

/**
 * Registers abs.
 *
 * @returns The result produced by `registerAbs`.
 *
 * @example
 * registerAbs();
 */

export function registerAbs(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[number], number>("abs", {
		handler: ([num]) => Math.abs(num),
		inputSchema: z.tuple([z.number()]),
		outputSchema: z.number(),
		metadata: {
			name: "abs",
			title: "Absolute Value",
			description: "Returns the absolute value of a number",
			category: "numeric",
			tags: ["arithmetic", "basic"],
			examples: [
				{
					description: "Absolute value of -5",
					input: {},
					rule: { abs: [-5] },
					output: 5,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers to number.
 *
 * @returns The result produced by `registerToNumber`.
 *
 * @example
 * registerToNumber();
 */

export function registerToNumber(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], number | null>("to_number", {
		handler: ([value]) => {
			if (typeof value === "number") {
				return Number.isFinite(value) ? value : null;
			}
			if (typeof value !== "string") {
				return null;
			}
			const normalized = value.trim();
			if (normalized.length === 0) {
				return null;
			}
			const parsed = Number(normalized);
			return Number.isFinite(parsed) ? parsed : null;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.number().nullable(),
		metadata: {
			name: "to_number",
			title: "To Number",
			description: "Coerces a number-like input to a finite number or null",
			category: "numeric",
			tags: ["coercion", "parsing", "forms"],
			examples: [
				{
					description: "Coerce a numeric string",
					input: {},
					rule: { to_number: ["42.5"] },
					output: 42.5,
				},
				{
					description: "Return null for invalid input",
					input: {},
					rule: { to_number: ["abc"] },
					output: null,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers to integer.
 *
 * @returns The result produced by `registerToInteger`.
 *
 * @example
 * registerToInteger();
 */

export function registerToInteger(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], number | null>("to_integer", {
		handler: ([value]) => {
			if (typeof value === "number") {
				return Number.isInteger(value) ? value : null;
			}
			if (typeof value !== "string") {
				return null;
			}
			const normalized = value.trim();
			if (!/^-?\d+$/.test(normalized)) {
				return null;
			}
			const parsed = Number.parseInt(normalized, 10);
			return Number.isSafeInteger(parsed) ? parsed : null;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.number().int().nullable(),
		metadata: {
			name: "to_integer",
			title: "To Integer",
			description: "Coerces an integer-like input to an integer or null",
			category: "numeric",
			tags: ["coercion", "parsing", "forms"],
			examples: [
				{
					description: "Coerce an integer string",
					input: {},
					rule: { to_integer: ["42"] },
					output: 42,
				},
				{
					description: "Return null for decimal input",
					input: {},
					rule: { to_integer: ["42.5"] },
					output: null,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
