import {
	defineAsyncOperator,
	type OperatorRegistry,
} from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers unique.
 *
 * @returns The result produced by `registerUnique`.
 *
 * @example
 * registerUnique();
 */

export function registerUnique(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator("unique", {
		handler: async (args, data) => {
			const [projectionName, field, value] = args;
			const projections = (data as Record<string, unknown>)?.projections as
				| Record<
						string,
						{ query: (filter: Record<string, unknown>) => Promise<unknown[]> }
				  >
				| undefined;

			if (!projections) {
				throw new Error("unique validator requires projections context");
			}

			const projection = projections[projectionName];
			if (!projection) {
				throw new Error(`Projection "${projectionName}" not found`);
			}

			const fieldName = field ?? "id";
			const results = await projection.query({ [fieldName]: value });
			return results.length === 0;
		},
		inputSchema: z.tuple([z.string(), z.string().optional(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "unique",
			title: "Unique",
			description:
				"Check if value is unique in a projection (no existing record with this value)",
			category: "validation",
			tags: ["validation", "async", "projection", "unique"],
			examples: [
				{
					description: "Check email uniqueness",
					input: { projections: { contacts: { query: async () => [] } } },
					rule: { unique: ["contacts", "email", "test@example.com"] },
					output: true,
				},
			],
			complexity: "O(n)",
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
	defineAsyncOperator("exists", {
		handler: async (args, data) => {
			const [projectionName, field, value] = args;
			const projections = (data as Record<string, unknown>)?.projections as
				| Record<
						string,
						{ query: (filter: Record<string, unknown>) => Promise<unknown[]> }
				  >
				| undefined;

			if (!projections) {
				throw new Error("exists validator requires projections context");
			}

			const projection = projections[projectionName];
			if (!projection) {
				throw new Error(`Projection "${projectionName}" not found`);
			}

			const fieldName = field ?? "id";
			const results = await projection.query({ [fieldName]: value });
			return results.length > 0;
		},
		inputSchema: z.tuple([z.string(), z.string().optional(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "exists",
			title: "Exists",
			description:
				"Check if a record exists in a projection with the given value",
			category: "validation",
			tags: ["validation", "async", "projection", "exists"],
			examples: [
				{
					description: "Check if user exists",
					input: {
						projections: { users: { query: async () => [{ id: "user_123" }] } },
					},
					rule: { exists: ["users", "id", "user_123"] },
					output: true,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
