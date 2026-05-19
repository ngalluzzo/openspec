import {
	defineSyncOperator,
	evaluateRule,
	isTruthy,
} from "@gooi/expresso-core";
import type { OperatorRegistry, Rule } from "@gooi/expresso-core";

import { z } from "zod";
import { buildEvalOpts } from "./helpers";

/**
 * Registers find.
 *
 * @returns The result produced by `registerFind`.
 *
 * @example
 * registerFind();
 */

export function registerFind(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("find", {
		handler: ([array, rule], _data, ctx) => {
			if (!Array.isArray(array)) return undefined;
			for (const item of array) {
				const result = evaluateRule(rule as Rule, item, buildEvalOpts(ctx));
				if (isTruthy(result, ctx.truthinessMode)) return item;
			}
			return undefined;
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "find",
			title: "Find",
			description: "Find first element matching a rule",
			category: "array",
			tags: ["array", "search"],
			examples: [
				{
					description: "Find first even number",
					input: {},
					rule: {
						find: [[1, 3, 4, 5, 6], { "==": [{ "%": [{ var: "" }, 2] }, 0] }],
					},
					output: 4,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers find index.
 *
 * @returns The result produced by `registerFindIndex`.
 *
 * @example
 * registerFindIndex();
 */

export function registerFindIndex(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], number>("find_index", {
		handler: ([array, rule], _data, ctx) => {
			if (!Array.isArray(array)) return -1;
			for (let i = 0; i < array.length; i++) {
				const result = evaluateRule(rule as Rule, array[i], buildEvalOpts(ctx));
				if (isTruthy(result, ctx.truthinessMode)) return i;
			}
			return -1;
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.number(),
		metadata: {
			name: "find_index",
			title: "Find Index",
			description: "Find index of first element matching a rule",
			category: "array",
			tags: ["array", "search"],
			examples: [
				{
					description: "Find index of first even number",
					input: {},
					rule: {
						find_index: [
							[1, 3, 4, 5, 6],
							{ "==": [{ "%": [{ var: "" }, 2] }, 0] },
						],
					},
					output: 2,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers group by.
 *
 * @returns The result produced by `registerGroupBy`.
 *
 * @example
 * registerGroupBy();
 */

export function registerGroupBy(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], Record<string, unknown[]>>("group_by", {
		handler: ([array, property]) => {
			if (!Array.isArray(array)) return {};
			const result: Record<string, unknown[]> = {};
			for (const item of array) {
				if (typeof item !== "object" || item === null || Array.isArray(item))
					continue;
				const key = String(
					(item as Record<string, unknown>)[String(property)] ?? "null",
				);
				if (!result[key]) result[key] = [];
				result[key].push(item);
			}
			return result;
		},
		inputSchema: z.tuple([z.array(z.any()), z.string()]),
		outputSchema: z.record(z.string(), z.array(z.any())),
		metadata: {
			name: "group_by",
			title: "Group By",
			description: "Group array of objects by property",
			category: "array",
			tags: ["array", "aggregation"],
			examples: [
				{
					description: "Group by category",
					input: {},
					rule: {
						group_by: [
							[
								{ name: "apple", type: "fruit" },
								{ name: "carrot", type: "vegetable" },
								{ name: "banana", type: "fruit" },
							],
							"type",
						],
					},
					output: {
						fruit: [
							{ name: "apple", type: "fruit" },
							{ name: "banana", type: "fruit" },
						],
						vegetable: [{ name: "carrot", type: "vegetable" }],
					},
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}
