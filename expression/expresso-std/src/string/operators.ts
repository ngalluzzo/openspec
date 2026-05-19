import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers split.
 *
 * @returns The result produced by `registerSplit`.
 *
 * @example
 * registerSplit();
 */

export function registerSplit(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], string[]>("split", {
		handler: ([string, delimiter]) => {
			const str = String(string ?? "");
			const delim = String(delimiter ?? "");
			return str.split(delim);
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.array(z.string()),
		metadata: {
			name: "split",
			title: "Split",
			description: "Split string by delimiter",
			category: "string",
			tags: ["string", "manipulation"],
			examples: [
				{
					description: "Split string by comma",
					input: {},
					rule: { split: ["hello,world", ","] },
					output: ["hello", "world"],
				},
				{
					description: "Split string by space",
					input: {},
					rule: { split: ["hello world", " "] },
					output: ["hello", "world"],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers trim.
 *
 * @returns The result produced by `registerTrim`.
 *
 * @example
 * registerTrim();
 */

export function registerTrim(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("trim", {
		handler: ([string]) => String(string ?? "").trim(),
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "trim",
			title: "Trim",
			description: "Remove whitespace from both ends",
			category: "string",
			tags: ["string", "whitespace"],
			examples: [
				{
					description: "Trim whitespace from string",
					input: {},
					rule: { trim: ["  hello  "] },
					output: "hello",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers to lower.
 *
 * @returns The result produced by `registerToLower`.
 *
 * @example
 * registerToLower();
 */

export function registerToLower(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("to_lower", {
		handler: ([string]) => String(string ?? "").toLowerCase(),
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "to_lower",
			title: "To Lower",
			description: "Convert to lowercase",
			category: "string",
			tags: ["string", "case"],
			examples: [
				{
					description: "Convert string to lowercase",
					input: {},
					rule: { to_lower: ["HELLO"] },
					output: "hello",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers to upper.
 *
 * @returns The result produced by `registerToUpper`.
 *
 * @example
 * registerToUpper();
 */

export function registerToUpper(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("to_upper", {
		handler: ([string]) => String(string ?? "").toUpperCase(),
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "to_upper",
			title: "To Upper",
			description: "Convert to uppercase",
			category: "string",
			tags: ["string", "case"],
			examples: [
				{
					description: "Convert string to uppercase",
					input: {},
					rule: { to_upper: ["hello"] },
					output: "HELLO",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers cat.
 *
 * @returns The result produced by `registerCat`.
 *
 * @example
 * registerCat();
 */

export function registerCat(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], string>("cat", {
		handler: ([...values]) => values.map((v) => String(v ?? "")).join(""),
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.string(),
		metadata: {
			name: "cat",
			title: "Concatenate",
			description: "Concatenate strings",
			category: "string",
			tags: ["string", "manipulation"],
			examples: [
				{
					description: "Concatenate strings",
					input: {},
					rule: { cat: ["hello", " ", "world"] },
					output: "hello world",
				},
				{
					description: "Concatenate numbers as strings",
					input: {},
					rule: { cat: [1, 2, 3] },
					output: "123",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers substr.
 *
 * @returns The result produced by `registerSubstr`.
 *
 * @example
 * registerSubstr();
 */

export function registerSubstr(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, number, number?], string>("substr", {
		handler: ([string, start, length]) => {
			const str = String(string ?? "");
			const s = typeof start === "number" ? start : 0;
			const len = typeof length === "number" ? length : str.length - s;

			if (s < 0) {
				return str.substring(
					Math.max(0, str.length + s),
					Math.max(0, str.length + s + len),
				);
			}

			return str.substring(s, s + len);
		},
		inputSchema: z.union([
			z.tuple([z.any(), z.number()]),
			z.tuple([z.any(), z.number(), z.number()]),
		]),
		outputSchema: z.string(),
		metadata: {
			name: "substr",
			title: "Substring",
			description: "Extract substring",
			category: "string",
			tags: ["string", "extraction"],
			examples: [
				{
					description: "Extract substring from start",
					input: {},
					rule: { substr: ["hello", 1] },
					output: "ello",
				},
				{
					description: "Extract substring with length",
					input: {},
					rule: { substr: ["hello", 1, 2] },
					output: "el",
				},
				{
					description: "Extract substring with negative index",
					input: {},
					rule: { substr: ["hello", -2] },
					output: "lo",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
