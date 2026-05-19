import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers merge.
 *
 * @returns The result produced by `registerMerge`.
 *
 * @example
 * registerMerge();
 */

export function registerMerge(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[][], unknown[]>("merge", {
		handler: ([...arrays]) => {
			const result: unknown[] = [];
			for (const arr of arrays) {
				if (Array.isArray(arr)) {
					result.push(...arr);
				}
			}
			return result;
		},
		inputSchema: z.array(z.array(z.any())).min(1),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "merge",
			title: "Merge",
			description: "Concatenate multiple arrays together",
			category: "array",
			tags: ["array", "concatenation", "basic"],
			examples: [],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers flatten.
 *
 * @returns The result produced by `registerFlatten`.
 *
 * @example
 * registerFlatten();
 */

export function registerFlatten(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown[]>("flatten", {
		handler: ([array]) => {
			if (!Array.isArray(array)) return [];
			const result: unknown[] = [];
			const flattenRecursive = (arr: unknown[]) => {
				for (const item of arr) {
					if (Array.isArray(item)) {
						flattenRecursive(item);
					} else {
						result.push(item);
					}
				}
			};
			flattenRecursive(array);
			return result;
		},
		inputSchema: z.tuple([z.array(z.any())]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "flatten",
			title: "Flatten",
			description: "Flatten nested arrays into a single array",
			category: "array",
			tags: ["array", "transformation"],
			examples: [
				{
					description: "Flatten nested array",
					input: {},
					rule: { flatten: [[1, [2, [3, 4]], 5]] },
					output: [1, 2, 3, 4, 5],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers unique.
 *
 * @returns The result produced by `registerUnique`.
 *
 * @example
 * registerUnique();
 */

export function registerUnique(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown[]>("unique", {
		handler: ([array]) => {
			if (!Array.isArray(array)) return [];
			return Array.from(new Set(array));
		},
		inputSchema: z.tuple([z.array(z.any())]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "unique",
			title: "Unique",
			description: "Remove duplicate values from array",
			category: "array",
			tags: ["array", "transformation"],
			examples: [
				{
					description: "Remove duplicates",
					input: {},
					rule: { unique: [[1, 2, 2, 3, 3, 3]] },
					output: [1, 2, 3],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers sort.
 *
 * @returns The result produced by `registerSort`.
 *
 * @example
 * registerSort();
 */

export function registerSort(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown[]>("sort", {
		handler: ([array]) => {
			if (!Array.isArray(array)) return [];
			return [...array].sort((a, b) => {
				if (typeof a === "number" && typeof b === "number") return a - b;
				if (typeof a === "string" && typeof b === "string")
					return a.localeCompare(b);
				return String(a).localeCompare(String(b));
			});
		},
		inputSchema: z.tuple([z.array(z.any())]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "sort",
			title: "Sort",
			description: "Sort array elements in ascending order",
			category: "array",
			tags: ["array", "sorting"],
			examples: [
				{
					description: "Sort numbers",
					input: {},
					rule: { sort: [[3, 1, 4, 1, 5]] },
					output: [1, 1, 3, 4, 5],
				},
			],
			complexity: "O(n log n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers sort by.
 *
 * @returns The result produced by `registerSortBy`.
 *
 * @example
 * registerSortBy();
 */

export function registerSortBy(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown[], string], unknown[]>("sort_by", {
		handler: ([array, property]) => {
			if (!Array.isArray(array)) return [];
			return [...array].sort((a, b) => {
				const aVal =
					typeof a === "object" && a !== null
						? (a as Record<string, unknown>)[String(property)]
						: a;
				const bVal =
					typeof b === "object" && b !== null
						? (b as Record<string, unknown>)[String(property)]
						: b;
				if (typeof aVal === "number" && typeof bVal === "number")
					return aVal - bVal;
				if (typeof aVal === "string" && typeof bVal === "string")
					return aVal.localeCompare(bVal);
				return String(aVal || "").localeCompare(String(bVal || ""));
			});
		},
		inputSchema: z.tuple([z.array(z.any()), z.string()]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "sort_by",
			title: "Sort By",
			description: "Sort array of objects by property",
			category: "array",
			tags: ["array", "sorting"],
			examples: [
				{
					description: "Sort objects by age",
					input: {},
					rule: {
						sort_by: [
							[
								{ name: "John", age: 25 },
								{ name: "Jane", age: 20 },
							],
							"age",
						],
					},
					output: [
						{ name: "Jane", age: 20 },
						{ name: "John", age: 25 },
					],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}
