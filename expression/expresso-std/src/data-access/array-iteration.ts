import type { OperatorRegistry, Rule } from "@gooi/expresso-core";
import {
	defineAsyncOperator,
	evaluateRuleAsync,
	isTruthy,
} from "@gooi/expresso-core";

import { z } from "zod";
import { buildEvalOpts, buildEvalOptsWithScopes } from "./helpers";

/**
 * Registers map.
 *
 * @returns The result produced by `registerMap`.
 *
 * @example
 * registerMap();
 */

export function registerMap(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule], unknown[]>("map", {
		handler: async ([array, rule], data, ctx) => {
			const arrayToMap = Array.isArray(array)
				? array
				: await evaluateRuleAsync(array as Rule, data, ctx);
			if (!Array.isArray(arrayToMap)) {
				return [];
			}
			return Promise.all(
				arrayToMap.map((item, index) => {
					const parentScopes = ctx.scopes || [];
					const itemData = item;
					return evaluateRuleAsync(
						rule as Rule,
						itemData,
						buildEvalOptsWithScopes(ctx, [
							...parentScopes,
							{
								data: itemData,
								iteration: {
									index,
									total: arrayToMap.length,
									first: index === 0,
									last: index === arrayToMap.length - 1,
								},
							},
						]),
					);
				}),
			);
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "map",
			title: "Map",
			description: "Transform each element of an array using a rule",
			category: "array",
			tags: ["array", "transformation", "basic"],
			examples: [
				{
					description: "Double each number",
					input: {},
					rule: { map: [[1, 2, 3], { "*": [{ var: "" }, 2] }] },
					output: [2, 4, 6],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
			preserveRules: true,
			preserveRawArrays: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers reduce.
 *
 * @returns The result produced by `registerReduce`.
 *
 * @example
 * registerReduce();
 */

export function registerReduce(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule, unknown], unknown>("reduce", {
		handler: async ([rawArray, rule, initial], data, ctx) => {
			const array = Array.isArray(rawArray)
				? rawArray
				: await evaluateRuleAsync(rawArray as Rule, data, ctx);
			if (!Array.isArray(array)) {
				return initial;
			}
			let acc: unknown = initial;
			for (const item of array) {
				const reduceData = { accumulator: acc, current: item };
				acc = await evaluateRuleAsync(rule as Rule, reduceData, {
					...buildEvalOpts(ctx),
					lazy: ctx.lazy,
				});
			}
			return acc;
		},
		inputSchema: z.tuple([z.any(), z.any(), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "reduce",
			title: "Reduce",
			description: "Reduce array to single value using a rule",
			category: "array",
			tags: ["array", "aggregation"],
			examples: [
				{
					description: "Sum array",
					input: {},
					rule: {
						reduce: [
							[1, 2, 3],
							{ "+": [{ var: "accumulator" }, { var: "current" }] },
							0,
						],
					},
					output: 6,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
			preserveRules: true,
			preserveRawArrays: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers filter.
 *
 * @returns The result produced by `registerFilter`.
 *
 * @example
 * registerFilter();
 */

export function registerFilter(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule], unknown[]>("filter", {
		handler: async ([array, rule], data, ctx) => {
			const arrayToFilter = Array.isArray(array)
				? array
				: await evaluateRuleAsync(array as Rule, data, ctx);
			if (!Array.isArray(arrayToFilter)) {
				return [];
			}
			return Promise.all(
				arrayToFilter.map((item, index) => {
					const parentScopes = ctx.scopes || [];
					const itemData = item;
					return evaluateRuleAsync(
						rule as Rule,
						itemData,
						buildEvalOptsWithScopes(ctx, [
							...parentScopes,
							{
								data: itemData,
								iteration: {
									index,
									total: arrayToFilter.length,
									first: index === 0,
									last: index === arrayToFilter.length - 1,
								},
							},
						]),
					);
				}),
			).then((r) =>
				arrayToFilter.filter((_, index) =>
					isTruthy(r[index], ctx.truthinessMode),
				),
			);
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "filter",
			title: "Filter",
			description: "Filter array elements using a rule",
			category: "array",
			tags: ["array", "filtering", "basic"],
			examples: [
				{
					description: "Filter even numbers",
					input: {},
					rule: {
						filter: [[1, 2, 3, 4, 5], { "==": [{ "%": [{ var: "" }, 2] }, 0] }],
					},
					output: [2, 4],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
			preserveRules: true,
			preserveRawArrays: true,
		},
		eager: true,
	})(operatorRegistry);
}
