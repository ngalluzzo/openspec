import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers merge deep.
 *
 * @returns The result produced by `registerMergeDeep`.
 *
 * @example
 * registerMergeDeep();
 */

export function registerMergeDeep(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<Record<string, unknown>[], Record<string, unknown>>(
		"merge_deep",
		{
			handler: ([...objects]) => {
				const result: Record<string, unknown> = {};
				for (const obj of objects) {
					if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
						for (const key of Object.keys(obj)) {
							const value = obj[key];
							if (
								typeof value === "object" &&
								value !== null &&
								!Array.isArray(value) &&
								typeof result[key] === "object" &&
								result[key] !== null &&
								!Array.isArray(result[key])
							) {
								result[key] = {
									...(result[key] as Record<string, unknown>),
									...(value as Record<string, unknown>),
								};
							} else {
								result[key] = value;
							}
						}
					}
				}
				return result;
			},
			inputSchema: z.array(z.record(z.string(), z.any())).min(2),
			outputSchema: z.record(z.string(), z.any()),
			metadata: {
				name: "merge_deep",
				title: "Merge Deep",
				description: "Deep merge multiple objects together",
				category: "object",
				tags: ["object", "merge", "transformation"],
				examples: [
					{
						description: "Deep merge two objects",
						input: {},
						rule: {
							merge_deep: [
								{ user: { name: "John" } },
								{ user: { age: 25 }, active: true },
							],
						},
						output: { user: { name: "John", age: 25 }, active: true },
					},
				],
				complexity: "O(n)",
				jsonlogicCompatible: false,
			},
			eager: true,
		},
	)(operatorRegistry);
}
