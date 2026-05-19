import {
	defineAsyncOperator,
	evaluateRuleAsync,
	isTruthy,
} from "@gooi/expresso-core";
import type { OperatorRegistry, Rule } from "@gooi/expresso-core";

import { z } from "zod";
import { buildEvalOpts } from "./helpers";

/**
 * Registers all.
 *
 * @returns The result produced by `registerAll`.
 *
 * @example
 * registerAll();
 */

export function registerAll(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule], boolean>("all", {
		handler: async ([array, rule], _data, ctx) => {
			if (!Array.isArray(array)) {
				return false;
			}
			return Promise.all(
				array.map((item) =>
					evaluateRuleAsync(rule as Rule, item, buildEvalOpts(ctx)),
				),
			).then((results) =>
				results.every((result) => isTruthy(result, ctx.truthinessMode)),
			);
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "all",
			title: "All",
			description: "Check if all elements match a rule",
			category: "array",
			tags: ["array", "predicate"],
			examples: [
				{
					description: "All numbers positive",
					input: {},
					rule: { all: [[1, 2, 3], { ">": [{ var: "" }, 0] }] },
					output: true,
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
 * Registers none.
 *
 * @returns The result produced by `registerNone`.
 *
 * @example
 * registerNone();
 */

export function registerNone(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule], boolean>("none", {
		handler: async ([array, rule], _data, ctx) => {
			if (!Array.isArray(array)) {
				return true;
			}
			return Promise.all(
				array.map((item) =>
					evaluateRuleAsync(rule as Rule, item, buildEvalOpts(ctx)),
				),
			).then((results) =>
				results.every((result) => !isTruthy(result, ctx.truthinessMode)),
			);
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "none",
			title: "None",
			description: "Check if no elements match a rule",
			category: "array",
			tags: ["array", "predicate"],
			examples: [
				{
					description: "No negative numbers",
					input: {},
					rule: { none: [[1, 2, 3], { "<": [{ var: "" }, 0] }] },
					output: true,
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
 * Registers some.
 *
 * @returns The result produced by `registerSome`.
 *
 * @example
 * registerSome();
 */

export function registerSome(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[unknown[], Rule], boolean>("some", {
		handler: async ([array, rule], _data, ctx) => {
			if (!Array.isArray(array)) {
				return false;
			}
			const evalOpts = buildEvalOpts(ctx);
			return Promise.all(
				array.map((item) => evaluateRuleAsync(rule as Rule, item, evalOpts)),
			).then((results) =>
				results.some((result) => isTruthy(result, ctx.truthinessMode)),
			);
		},
		inputSchema: z.tuple([z.array(z.any()), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "some",
			title: "Some",
			description: "Check if any element matches a rule",
			category: "array",
			tags: ["array", "predicate"],
			examples: [
				{
					description: "Some numbers positive",
					input: {},
					rule: { some: [[-1, 0, 1], { ">": [{ var: "" }, 0] }] },
					output: true,
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
