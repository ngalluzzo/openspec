import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import {
	getIterationMetadata,
	getValueByPath,
	getValueByPathWithScope,
} from "./helpers";

/**
 * Registers var.
 *
 * @returns The result produced by `registerVar`.
 *
 * @example
 * registerVar();
 */

export function registerVar(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown] | [unknown, unknown], unknown>("var", {
		handler: (args, _data, ctx) => {
			const [path, defaultValue] = args;

			const metadataValue = getIterationMetadata(
				ctx.scopes,
				typeof path === "string" ? path : "",
			);
			if (metadataValue !== undefined) {
				return metadataValue;
			}

			if (
				typeof path === "object" &&
				path !== null &&
				"__dataMarker" in path &&
				path.__dataMarker === true
			) {
				return (path as { __dataMarker: true; value: unknown }).value;
			}

			if (
				typeof path === "object" &&
				path !== null &&
				!("__dataMarker" in path)
			) {
				const entries = Object.entries(path);
				if (entries.length === 1 && entries[0]?.[0] !== "@data") {
					throw new Error(
						`Invalid @data marker: expected '@data' key, got '${entries[0]?.[0]}'`,
					);
				}
				if (entries.length !== 1 && entries.some(([key]) => key === "@data")) {
					throw new Error(`Invalid @data marker: '@data' must be the only key`);
				}
			}

			const pathStr = typeof path === "string" ? path : "";
			const value = getValueByPathWithScope(ctx.scopes, pathStr);
			if (value !== undefined) return value;

			if (
				typeof defaultValue === "object" &&
				defaultValue !== null &&
				"__dataMarker" in defaultValue &&
				defaultValue.__dataMarker === true
			) {
				return (defaultValue as { __dataMarker: true; value: unknown }).value;
			}

			return defaultValue;
		},
		inputSchema: z.union([z.tuple([z.any()]), z.tuple([z.any(), z.any()])]),
		outputSchema: z.any(),
		metadata: {
			name: "var",
			title: "Variable",
			description:
				"Access nested data by path, parent scopes with ../, and iteration metadata",
			category: "data-access",
			tags: ["data", "access", "basic"],
			examples: [
				{
					description: "Access nested property",
					input: { user: { name: "John", age: 25 } },
					rule: { var: "user.name" },
					output: "John",
				},
				{
					description: "Access with default value",
					input: { user: { name: "John" } },
					rule: { var: ["user.email", "default@example.com"] },
					output: "default@example.com",
				},
				{
					description: "Access parent scope with ../",
					input: { multiplier: 10 },
					rule: {
						map: [[1, 2, 3], { "+": [{ var: "" }, { var: "../multiplier" }] }],
					},
					output: [11, 12, 13],
				},
				{
					description: "Access iteration metadata @index",
					input: {},
					rule: {
						map: [["a", "b", "c"], { var: "@index" }],
					},
					output: [0, 1, 2],
				},
				{
					description: "Access iteration metadata @first",
					input: {},
					rule: {
						map: [[1, 2, 3], { var: "@first" }],
					},
					output: [true, false, false],
				},
				{
					description: "Access iteration metadata @last",
					input: {},
					rule: {
						map: [[1, 2, 3], { var: "@last" }],
					},
					output: [false, false, true],
				},
				{
					description: "Access iteration metadata @total",
					input: {},
					rule: {
						map: [[1, 2, 3, 4, 5], { var: "@total" }],
					},
					output: [5, 5, 5, 5, 5],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers missing.
 *
 * @returns The result produced by `registerMissing`.
 *
 * @example
 * registerMissing();
 */

export function registerMissing(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string[]], boolean>("missing", {
		handler: ([fields], data, _ctx) => {
			if (!Array.isArray(fields)) {
				return false;
			}

			return fields.some((field) => {
				const value = getValueByPath(data, field);
				return value === undefined || value === null;
			});
		},
		inputSchema: z.tuple([z.array(z.string())]),
		outputSchema: z.boolean(),
		metadata: {
			name: "missing",
			title: "Missing",
			description: "Check if any fields are missing (null or undefined)",
			category: "data-access",
			tags: ["validation", "data", "basic"],
			examples: [
				{
					description: "Check if field is missing",
					input: { user: { name: "John" } },
					rule: { missing: [["user.email", "user.phone"]] },
					output: true,
				},
				{
					description: "Check if all fields present",
					input: {
						user: {
							name: "John",
							email: "john@example.com",
							phone: "555-1234",
						},
					},
					rule: { missing: [["user.email", "user.phone"]] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers missing some.
 *
 * @returns The result produced by `registerMissingSome`.
 *
 * @example
 * registerMissingSome();
 */

export function registerMissingSome(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<
		[number, string[]],
		{ missing: string[]; present: number; count: number }
	>("missing_some", {
		handler: ([count, fields], data, _ctx) => {
			if (typeof count !== "number" || !Array.isArray(fields)) {
				return { missing: [], present: 0, count };
			}

			const missing = fields.filter((field) => {
				const value = getValueByPath(data, field);
				return value === undefined || value === null;
			});

			return {
				missing,
				present: fields.length - missing.length,
				count,
			};
		},
		inputSchema: z.tuple([z.number(), z.array(z.string())]),
		outputSchema: z.any(),
		metadata: {
			name: "missing_some",
			title: "Missing Some",
			description: "Check if at least N fields are missing",
			category: "data-access",
			tags: ["validation", "data"],
			examples: [
				{
					description: "Check if at least 2 fields missing",
					input: { user: { name: "John" } },
					rule: {
						missing_some: [2, ["user.email", "user.phone", "user.address"]],
					},
					output: {
						missing: ["user.email", "user.phone", "user.address"],
						present: 0,
						count: 2,
					},
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: true,
		},
		eager: true,
	})(operatorRegistry);
}
