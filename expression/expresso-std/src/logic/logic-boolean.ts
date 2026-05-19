import { defineSyncOperator, isTruthy } from "@gooi/expresso-core";
import type { EvaluationContext, OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers or.
 *
 * @returns The result produced by `registerOr`.
 *
 * @example
 * registerOr();
 */

export function registerOr(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("or", {
		handler: ([...values], _data, ctx: EvaluationContext) => {
			for (const value of values) {
				if (isTruthy(value, ctx.truthinessMode)) {
					return value;
				}
			}
			return values[values.length - 1] ?? false;
		},
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.any(),
		metadata: {
			name: "or",
			title: "Or",
			description: "Logical OR with short-circuit evaluation",
			category: "logic",
			tags: ["logic", "boolean", "basic"],
			examples: [
				{
					description: "One value true",
					input: {},
					rule: { or: [false, true, false] },
					output: true,
				},
				{
					description: "All values false",
					input: {},
					rule: { or: [false, false, false] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers and.
 *
 * @returns The result produced by `registerAnd`.
 *
 * @example
 * registerAnd();
 */

export function registerAnd(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("and", {
		handler: ([...values], _data, ctx: EvaluationContext) => {
			for (const value of values) {
				if (!isTruthy(value, ctx.truthinessMode)) {
					return value;
				}
			}
			return values[values.length - 1] ?? true;
		},
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.any(),
		metadata: {
			name: "and",
			title: "And",
			description: "Logical AND with short-circuit evaluation",
			category: "logic",
			tags: ["logic", "boolean", "basic"],
			examples: [
				{
					description: "All values true",
					input: {},
					rule: { and: [true, true, true] },
					output: true,
				},
				{
					description: "One value false",
					input: {},
					rule: { and: [true, false, true] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers not.
 *
 * @returns The result produced by `registerNot`.
 *
 * @example
 * registerNot();
 */

export function registerNot(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], boolean>("!", {
		handler: ([value], _data, ctx: EvaluationContext) =>
			!isTruthy(value, ctx.truthinessMode),
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!",
			title: "Not",
			description: "Logical NOT operator",
			category: "logic",
			tags: ["logic", "boolean", "basic"],
			examples: [
				{
					description: "Not true",
					input: {},
					rule: { "!": [true] },
					output: false,
				},
				{
					description: "Not false",
					input: {},
					rule: { "!": [false] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers double not.
 *
 * @returns The result produced by `registerDoubleNot`.
 *
 * @example
 * registerDoubleNot();
 */

export function registerDoubleNot(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], boolean>("!!", {
		handler: ([value], _data, ctx: EvaluationContext) =>
			isTruthy(value, ctx.truthinessMode),
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!!",
			title: "Double Not",
			description: "Double logical NOT (converts to boolean)",
			category: "logic",
			tags: ["logic", "boolean", "basic"],
			examples: [
				{
					description: "Truthy value",
					input: {},
					rule: { "!!": ["hello"] },
					output: true,
				},
				{
					description: "Falsy value",
					input: {},
					rule: { "!!": [""] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers xor.
 *
 * @returns The result produced by `registerXor`.
 *
 * @example
 * registerXor();
 */

export function registerXor(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], boolean>("xor", {
		handler: ([...values], _data, ctx: EvaluationContext) => {
			let truthyCount = 0;
			for (const value of values) {
				if (isTruthy(value, ctx.truthinessMode)) {
					truthyCount++;
					if (truthyCount > 1) {
						return false;
					}
				}
			}
			return truthyCount === 1;
		},
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.boolean(),
		metadata: {
			name: "xor",
			title: "Xor",
			description:
				"Exclusive OR - returns true if exactly one operand is truthy",
			category: "logic",
			tags: ["logic", "boolean"],
			examples: [
				{
					description: "Exactly one true",
					input: {},
					rule: { xor: [true, false, false] },
					output: true,
				},
				{
					description: "Multiple true",
					input: {},
					rule: { xor: [true, true, false] },
					output: false,
				},
				{
					description: "None true",
					input: {},
					rule: { xor: [false, false, false] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers implies.
 *
 * @returns The result produced by `registerImplies`.
 *
 * @example
 * registerImplies();
 */

export function registerImplies(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("implies", {
		handler: ([p, q], _data, ctx: EvaluationContext) => {
			const pIsTruthy = isTruthy(p, ctx.truthinessMode);
			const qIsTruthy = isTruthy(q, ctx.truthinessMode);
			return !pIsTruthy || qIsTruthy;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "implies",
			title: "Implies",
			description:
				"Logical implication - returns true if p is false or q is true (equivalent to !p || q)",
			category: "logic",
			tags: ["logic", "boolean"],
			examples: [
				{
					description: "True implies true",
					input: {},
					rule: { implies: [true, true] },
					output: true,
				},
				{
					description: "True implies false",
					input: {},
					rule: { implies: [true, false] },
					output: false,
				},
				{
					description: "False implies anything",
					input: {},
					rule: { implies: [false, true] },
					output: true,
				},
				{
					description: "VIP implies premium",
					input: { vip: true, premium: true },
					rule: { implies: [{ var: "vip" }, { var: "premium" }] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
