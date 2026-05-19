import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers intersection.
 *
 * @returns The result produced by `registerIntersection`.
 *
 * @example
 * registerIntersection();
 */

export function registerIntersection(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[][], unknown[]>("intersection", {
		handler: ([...arrays]) => {
			if (arrays.length === 0 || !arrays.every(Array.isArray)) return [];
			return arrays.reduce((acc, arr) => {
				return acc.filter((item) => arr.includes(item));
			});
		},
		inputSchema: z.array(z.array(z.any())).min(2),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "intersection",
			title: "Intersection",
			description: "Find common elements across multiple arrays",
			category: "array",
			tags: ["array", "set"],
			examples: [
				{
					description: "Find common elements",
					input: {},
					rule: {
						intersection: [
							[1, 2, 3],
							[2, 3, 4],
							[3, 4, 5],
						],
					},
					output: [3],
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers difference.
 *
 * @returns The result produced by `registerDifference`.
 *
 * @example
 * registerDifference();
 */

export function registerDifference(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown[], unknown[]], unknown[]>("difference", {
		handler: ([array, others]) => {
			if (!Array.isArray(array)) return [];
			if (!Array.isArray(others)) return array;
			return array.filter((item) => !others.includes(item));
		},
		inputSchema: z.tuple([z.array(z.any()), z.array(z.any())]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "difference",
			title: "Difference",
			description: "Elements in first array not in second array",
			category: "array",
			tags: ["array", "set"],
			examples: [
				{
					description: "Find elements in A not in B",
					input: {},
					rule: {
						difference: [
							[1, 2, 3, 4],
							[3, 4, 5],
						],
					},
					output: [1, 2],
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers union.
 *
 * @returns The result produced by `registerUnion`.
 *
 * @example
 * registerUnion();
 */

export function registerUnion(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[][], unknown[]>("union", {
		handler: ([...arrays]) => {
			if (arrays.length === 0) return [];
			const allValues = arrays.flat();
			return Array.from(new Set(allValues));
		},
		inputSchema: z.array(z.array(z.any())).min(2),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "union",
			title: "Union",
			description: "Combine all unique elements from multiple arrays",
			category: "array",
			tags: ["array", "set"],
			examples: [
				{
					description: "Combine unique elements",
					input: {},
					rule: {
						union: [
							[1, 2, 3],
							[3, 4, 5],
							[5, 6],
						],
					},
					output: [1, 2, 3, 4, 5, 6],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
