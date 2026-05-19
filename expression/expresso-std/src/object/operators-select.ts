import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers pick.
 *
 * @returns The result produced by `registerPick`.
 *
 * @example
 * registerPick();
 */

export function registerPick(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string[]], Record<string, unknown>>("pick", {
		handler: ([obj, keys]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return {};
			const result: Record<string, unknown> = {};
			for (const key of keys) {
				if (key in obj) {
					result[key] = (obj as Record<string, unknown>)[key];
				}
			}
			return result;
		},
		inputSchema: z.tuple([z.any(), z.array(z.string())]),
		outputSchema: z.record(z.string(), z.any()),
		metadata: {
			name: "pick",
			title: "Pick",
			description: "Select specific keys from an object",
			category: "object",
			tags: ["object", "properties", "transformation"],
			examples: [
				{
					description: "Pick name and age from object",
					input: {},
					rule: {
						pick: [
							{ name: "John", age: 25, email: "john@example.com" },
							["name", "age"],
						],
					},
					output: { name: "John", age: 25 },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers omit.
 *
 * @returns The result produced by `registerOmit`.
 *
 * @example
 * registerOmit();
 */

export function registerOmit(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string[]], Record<string, unknown>>("omit", {
		handler: ([obj, keys]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return {};
			const result: Record<string, unknown> = {};
			const keySet = new Set(keys);
			for (const key of Object.keys(obj)) {
				if (!keySet.has(key)) {
					result[key] = (obj as Record<string, unknown>)[key];
				}
			}
			return result;
		},
		inputSchema: z.tuple([z.any(), z.array(z.string())]),
		outputSchema: z.record(z.string(), z.any()),
		metadata: {
			name: "omit",
			title: "Omit",
			description: "Remove specific keys from an object",
			category: "object",
			tags: ["object", "properties", "transformation"],
			examples: [
				{
					description: "Omit email from object",
					input: {},
					rule: {
						omit: [
							{ name: "John", age: 25, email: "john@example.com" },
							["email"],
						],
					},
					output: { name: "John", age: 25 },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}
