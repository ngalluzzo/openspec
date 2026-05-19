import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers keys.
 *
 * @returns The result produced by `registerKeys`.
 *
 * @example
 * registerKeys();
 */

export function registerKeys(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string[]>("keys", {
		handler: ([obj]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return [];
			return Object.keys(obj);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.array(z.string()),
		metadata: {
			name: "keys",
			title: "Keys",
			description: "Get object keys",
			category: "object",
			tags: ["object", "properties"],
			examples: [],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers values.
 *
 * @returns The result produced by `registerValues`.
 *
 * @example
 * registerValues();
 */

export function registerValues(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], unknown[]>("values", {
		handler: ([obj]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return [];
			return Object.values(obj);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.array(z.any()),
		metadata: {
			name: "values",
			title: "Values",
			description: "Get object values",
			category: "object",
			tags: ["object", "properties"],
			examples: [],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers entries.
 *
 * @returns The result produced by `registerEntries`.
 *
 * @example
 * registerEntries();
 */

export function registerEntries(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], unknown[]>("entries", {
		handler: ([obj]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return [];
			return Object.entries(obj);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "entries",
			title: "Entries",
			description: "Get object entries",
			category: "object",
			tags: ["object", "properties"],
			examples: [],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
