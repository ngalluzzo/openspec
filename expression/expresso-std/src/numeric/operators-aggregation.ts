import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers min.
 *
 * @returns The result produced by `registerMin`.
 *
 * @example
 * registerMin();
 */

export function registerMin(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<number[] | [number[]], number>("min", {
		handler: (args) => {
			const values =
				args.length === 1 && Array.isArray(args[0])
					? (args[0] as number[])
					: (args as number[]);
			return Math.min(...values);
		},
		inputSchema: z.union([
			z.array(z.number()).min(1),
			z.tuple([z.array(z.number()).min(1)]),
		]),
		outputSchema: z.number(),
		metadata: {
			name: "min",
			title: "Minimum",
			description: "Returns the minimum value from an array",
			category: "numeric",
			tags: ["aggregation", "basic"],
			examples: [
				{
					description: "Min of [1, 5, 3]",
					input: {},
					rule: { min: [[1, 5, 3]] },
					output: 1,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers max.
 *
 * @returns The result produced by `registerMax`.
 *
 * @example
 * registerMax();
 */

export function registerMax(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<number[] | [number[]], number>("max", {
		handler: (args) => {
			const values =
				args.length === 1 && Array.isArray(args[0])
					? (args[0] as number[])
					: (args as number[]);
			return Math.max(...values);
		},
		inputSchema: z.union([
			z.array(z.number()).min(1),
			z.tuple([z.array(z.number()).min(1)]),
		]),
		outputSchema: z.number(),
		metadata: {
			name: "max",
			title: "Maximum",
			description: "Returns the maximum value from an array",
			category: "numeric",
			tags: ["aggregation", "basic"],
			examples: [
				{
					description: "Max of [1, 5, 3]",
					input: {},
					rule: { max: [[1, 5, 3]] },
					output: 5,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
