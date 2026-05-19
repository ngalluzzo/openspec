import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers log.
 *
 * @returns The result produced by `registerLog`.
 *
 * @example
 * registerLog();
 */

export function registerLog(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("log", {
		handler: ([...args]) => {
			console.log(...args);
			return args[args.length - 1];
		},
		inputSchema: z.array(z.any()).min(1),
		outputSchema: z.any(),
		metadata: {
			name: "log",
			title: "Log",
			description: "Console log",
			category: "misc",
			tags: ["utility", "debugging"],
			examples: [],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers exists.
 *
 * @returns The result produced by `registerExists`.
 *
 * @example
 * registerExists();
 */

export function registerExists(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], boolean>("exists", {
		handler: ([value]) => value !== null && value !== undefined,
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "exists",
			title: "Exists",
			description: "Check if value is not null or undefined",
			category: "misc",
			tags: ["validation"],
			examples: [
				{
					description: "Check if value exists",
					input: { value: 42 },
					rule: { exists: [{ var: "value" }] },
					output: true,
				},
				{
					description: "Check if null value exists",
					input: { value: null },
					rule: { exists: [{ var: "value" }] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers not exists.
 *
 * @returns The result produced by `registerNotExists`.
 *
 * @example
 * registerNotExists();
 */

export function registerNotExists(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], boolean>("!exists", {
		handler: ([value]) => value === null || value === undefined,
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "!exists",
			title: "Not Exists",
			description: "Check if value is null or undefined",
			category: "misc",
			tags: ["validation"],
			examples: [
				{
					description: "Check if value does not exist",
					input: { value: null },
					rule: { "!exists": [{ var: "value" }] },
					output: true,
				},
				{
					description: "Check if value exists",
					input: { value: 42 },
					rule: { "!exists": [{ var: "value" }] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}
