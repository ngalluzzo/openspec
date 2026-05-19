import {
	defineSyncOperator,
	evaluateRule,
	isTruthy,
	type OperatorRegistry,
	type Rule,
} from "@gooi/expresso-core";

import { z } from "zod";
import { buildEvalOpts } from "../data-access/helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlainObj(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepObjectIncludes(
	obj: Record<string, unknown>,
	subset: Record<string, unknown>,
): boolean {
	for (const [key, value] of Object.entries(subset)) {
		if (!(key in obj)) return false;
		const candidate = obj[key];
		if (isPlainObj(candidate) && isPlainObj(value)) {
			if (!deepObjectIncludes(candidate, value)) return false;
			continue;
		}
		if (JSON.stringify(candidate) !== JSON.stringify(value)) return false;
	}
	return true;
}

function splitWords(v: string): string[] {
	// Split on case transitions and non-alphanumeric characters
	return v
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
		.split(/[^a-zA-Z0-9]+/)
		.filter((w) => w.length > 0);
}

// ---------------------------------------------------------------------------
// General operators
// ---------------------------------------------------------------------------

/**
 * Registers os_is_empty.
 * Named with os_ prefix to avoid conflict with the string plugin's is_empty
 * (which does not treat null/undefined or empty objects as empty).
 */
export function registerIsEmpty(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], boolean>("os_is_empty", {
		handler: ([v]) => {
			if (v === null || v === undefined) return true;
			if (typeof v === "string" || Array.isArray(v)) return v.length === 0;
			if (typeof v === "object") return Object.keys(v).length === 0;
			return false;
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "os_is_empty",
			title: "OS Is Empty",
			description:
				"Returns true if the value is null, undefined, an empty string, an empty array, or an empty object.",
			category: "openspec",
			tags: ["utility", "validation", "openspec"],
			examples: [
				{
					description: "Null returns true",
					input: {},
					rule: { os_is_empty: [null] },
					output: true,
				},
				{
					description: "Non-empty string returns false",
					input: {},
					rule: { os_is_empty: ["hello"] },
					output: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers json_stringify.
 */
export function registerJsonStringify(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string>("json_stringify", {
		handler: ([value]) => JSON.stringify(value ?? null),
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "json_stringify",
			title: "JSON Stringify",
			description: "Serializes a value to a JSON string.",
			category: "openspec",
			tags: ["utility", "json", "openspec"],
			examples: [
				{
					description: "Stringify an object",
					input: {},
					rule: { json_stringify: [{ a: 1 }] },
					output: '{"a":1}',
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers object_includes.
 */
export function registerObjectIncludes(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], boolean>("object_includes", {
		handler: ([obj, subset]) => {
			if (!isPlainObj(obj) || !isPlainObj(subset)) return false;
			return deepObjectIncludes(obj, subset);
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "object_includes",
			title: "Object Includes",
			description:
				"Returns true if all keys in subset exist in obj with matching values (deep recursive comparison).",
			category: "openspec",
			tags: ["object", "comparison", "openspec"],
			examples: [
				{
					description: "Object includes subset",
					input: {},
					rule: { object_includes: [{ a: 1, b: 2 }, { a: 1 }] },
					output: true,
				},
				{
					description: "Object does not include subset",
					input: {},
					rule: { object_includes: [{ a: 1 }, { b: 2 }] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers kebab_case.
 */
export function registerKebabCase(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string>("kebab_case", {
		handler: ([v]) => {
			if (typeof v !== "string") return "";
			return splitWords(v)
				.map((w) => w.toLowerCase())
				.join("-");
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "kebab_case",
			title: "Kebab Case",
			description:
				"Converts a string to kebab-case by splitting on case transitions and non-alphanumeric characters.",
			category: "openspec",
			tags: ["string", "case", "openspec"],
			examples: [
				{
					description: "camelCase to kebab-case",
					input: {},
					rule: { kebab_case: ["camelCaseString"] },
					output: "camel-case-string",
				},
				{
					description: "PascalCase to kebab-case",
					input: {},
					rule: { kebab_case: ["MyProtocol"] },
					output: "my-protocol",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers camel_case.
 */
export function registerCamelCase(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string>("camel_case", {
		handler: ([v]) => {
			if (typeof v !== "string") return "";
			const words = splitWords(v);
			if (words.length === 0) return "";
			return [
				words[0]?.toLowerCase(),
				...words
					.slice(1)
					.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
			].join("");
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "camel_case",
			title: "Camel Case",
			description: "Converts a string to camelCase.",
			category: "openspec",
			tags: ["string", "case", "openspec"],
			examples: [
				{
					description: "kebab-case to camelCase",
					input: {},
					rule: { camel_case: ["my-protocol-name"] },
					output: "myProtocolName",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers pascal_case.
 */
export function registerPascalCase(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string>("pascal_case", {
		handler: ([v]) => {
			if (typeof v !== "string") return "";
			const words = splitWords(v);
			return words
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
				.join("");
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "pascal_case",
			title: "Pascal Case",
			description: "Converts a string to PascalCase.",
			category: "openspec",
			tags: ["string", "case", "openspec"],
			examples: [
				{
					description: "kebab-case to PascalCase",
					input: {},
					rule: { pascal_case: ["my-protocol-name"] },
					output: "MyProtocolName",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers str_after.
 */
export function registerStrAfter(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, boolean?], string>("str_after", {
		handler: ([value, separator, optional]) => {
			if (typeof value !== "string") {
				if (optional) return "";
				throw new Error(`str_after: expected string, got ${typeof value}`);
			}
			const idx = value.indexOf(separator);
			if (idx === -1) {
				if (optional) return value;
				throw new Error(
					`str_after: separator "${separator}" not found in "${value}"`,
				);
			}
			return value.slice(idx + separator.length);
		},
		inputSchema: z.union([
			z.tuple([z.any(), z.string()]),
			z.tuple([z.any(), z.string(), z.boolean()]),
		]),
		outputSchema: z.string(),
		metadata: {
			name: "str_after",
			title: "String After",
			description:
				"Returns the substring after the first occurrence of a separator. Throws if not found unless optional is true.",
			category: "openspec",
			tags: ["string", "openspec"],
			examples: [
				{
					description: "Get part after colon",
					input: {},
					rule: { str_after: ["protocol.protocol:myProto.v1", ":"] },
					output: "myProto.v1",
				},
				{
					description: "Returns original if not found and optional",
					input: {},
					rule: { str_after: ["noSeparatorHere", ":", true] },
					output: "noSeparatorHere",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

// ---------------------------------------------------------------------------
// OpenSpec-scoped operators (os_ prefix)
// ---------------------------------------------------------------------------

/**
 * Registers os_literal.
 */
export function registerOsLiteral(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], unknown>("os_literal", {
		handler: ([value]) => value,
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "os_literal",
			title: "OS Literal",
			description:
				"Returns its argument as-is without evaluating it as a rule. Used to pass object/array literals through the bridge.",
			category: "openspec",
			tags: ["openspec", "literal"],
			examples: [
				{
					description: "Return a literal object",
					input: {},
					rule: { os_literal: [{ a: 1 }] },
					output: { a: 1 },
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
	})(operatorRegistry);
}

/**
 * Registers os_object.
 */
export function registerOsObject(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[Record<string, Rule>], Record<string, unknown>>(
		"os_object",
		{
			handler: ([fields]) => {
				if (!isPlainObj(fields)) return {};
				const result: Record<string, unknown> = {};
				for (const [key, value] of Object.entries(fields)) {
					if (value !== undefined) result[key] = value;
				}
				return result;
			},
			inputSchema: z.tuple([z.record(z.string(), z.any())]),
			outputSchema: z.record(z.string(), z.any()),
			metadata: {
				name: "os_object",
				title: "OS Object",
				description:
					"Builds an object by evaluating each value rule with the current data context. Keys with undefined results are omitted.",
				category: "openspec",
				tags: ["openspec", "object"],
				examples: [
					{
						description: "Build an object from rules",
						input: { name: "Alice", age: 30 },
						rule: {
							os_object: [
								{ fullName: { var: "name" }, userAge: { var: "age" } },
							],
						},
						output: { fullName: "Alice", userAge: 30 },
					},
				],
				complexity: "O(n)",
				jsonlogicCompatible: false,
				preserveRules: true,
			},
			eager: true,
		},
	)(operatorRegistry);
}

/**
 * Registers os_let.
 */
export function registerOsLet(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, Rule, Rule], unknown>("os_let", {
		handler: ([name, valueRule, bodyRule], data, ctx) => {
			const resolvedValue = evaluateRule(
				valueRule as Rule,
				data,
				buildEvalOpts(ctx),
			);
			const augmentedData = {
				...(data as Record<string, unknown>),
				[name]: resolvedValue,
			};
			return evaluateRule(bodyRule as Rule, augmentedData, buildEvalOpts(ctx));
		},
		inputSchema: z.tuple([z.string(), z.any(), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "os_let",
			title: "OS Let",
			description:
				"Evaluates a value rule, binds it to a name in the data context, then evaluates a body rule with the augmented context.",
			category: "openspec",
			tags: ["openspec", "binding"],
			examples: [
				{
					description: "Bind a value and use it",
					input: { x: 5 },
					rule: {
						os_let: ["doubled", { "*": [{ var: "x" }, 2] }, { var: "doubled" }],
					},
					output: 10,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers os_map.
 */
export function registerOsMap(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, Rule, boolean?, Rule?], unknown[]>(
		"os_map",
		{
			handler: (
				[arrayOrRule, asName, valueRule, optional, whenRule],
				data,
				ctx,
			) => {
				const array = Array.isArray(arrayOrRule)
					? arrayOrRule
					: evaluateRule(arrayOrRule as Rule, data, buildEvalOpts(ctx));

				if (!Array.isArray(array)) {
					if (optional) return [];
					throw new Error(`os_map: expected array, got ${typeof array}`);
				}

				const results: unknown[] = [];
				for (const item of array) {
					const mergedData = {
						...(data as Record<string, unknown>),
						[asName]: item,
					};
					if (whenRule !== undefined) {
						const whenResult = evaluateRule(
							whenRule as Rule,
							mergedData,
							buildEvalOpts(ctx),
						);
						if (!isTruthy(whenResult, ctx.truthinessMode)) continue;
					}
					const result = evaluateRule(
						valueRule as Rule,
						mergedData,
						buildEvalOpts(ctx),
					);
					results.push(result);
				}
				return results;
			},
			inputSchema: z.union([
				z.tuple([z.any(), z.string(), z.any()]),
				z.tuple([z.any(), z.string(), z.any(), z.boolean()]),
				z.tuple([z.any(), z.string(), z.any(), z.boolean(), z.any()]),
			]),
			outputSchema: z.array(z.any()),
			metadata: {
				name: "os_map",
				title: "OS Map",
				description:
					"Maps over an array, evaluating a value rule for each item with flat scope merging (item merged into data context under the given name).",
				category: "openspec",
				tags: ["openspec", "array", "iteration"],
				examples: [
					{
						description: "Map names from items",
						input: { items: [{ name: "Alice" }, { name: "Bob" }] },
						rule: {
							os_map: [{ var: "items" }, "item", { var: "item.name" }],
						},
						output: ["Alice", "Bob"],
					},
				],
				complexity: "O(n)",
				jsonlogicCompatible: false,
				preserveRules: true,
			},
			eager: true,
		},
	)(operatorRegistry);
}

/**
 * Registers os_flat_map.
 */
export function registerOsFlatMap(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, Rule, boolean?, Rule?], unknown[]>(
		"os_flat_map",
		{
			handler: (
				[arrayOrRule, asName, valueRule, optional, whenRule],
				data,
				ctx,
			) => {
				const array = Array.isArray(arrayOrRule)
					? arrayOrRule
					: evaluateRule(arrayOrRule as Rule, data, buildEvalOpts(ctx));

				if (!Array.isArray(array)) {
					if (optional) return [];
					throw new Error(`os_flat_map: expected array, got ${typeof array}`);
				}

				const results: unknown[] = [];
				for (const item of array) {
					const mergedData = {
						...(data as Record<string, unknown>),
						[asName]: item,
					};
					if (whenRule !== undefined) {
						const whenResult = evaluateRule(
							whenRule as Rule,
							mergedData,
							buildEvalOpts(ctx),
						);
						if (!isTruthy(whenResult, ctx.truthinessMode)) continue;
					}
					const result = evaluateRule(
						valueRule as Rule,
						mergedData,
						buildEvalOpts(ctx),
					);
					if (result === undefined) continue;
					if (Array.isArray(result)) {
						results.push(...result);
					} else {
						results.push(result);
					}
				}
				return results;
			},
			inputSchema: z.union([
				z.tuple([z.any(), z.string(), z.any()]),
				z.tuple([z.any(), z.string(), z.any(), z.boolean()]),
				z.tuple([z.any(), z.string(), z.any(), z.boolean(), z.any()]),
			]),
			outputSchema: z.array(z.any()),
			metadata: {
				name: "os_flat_map",
				title: "OS Flat Map",
				description:
					"Like os_map but flattens array results. If item result is an array it is spread into the output; undefined results are skipped.",
				category: "openspec",
				tags: ["openspec", "array", "iteration"],
				examples: [
					{
						description: "Flat map nested arrays",
						input: {
							groups: [{ members: ["Alice", "Bob"] }, { members: ["Charlie"] }],
						},
						rule: {
							os_flat_map: [
								{ var: "groups" },
								"group",
								{ var: "group.members" },
							],
						},
						output: ["Alice", "Bob", "Charlie"],
					},
				],
				complexity: "O(n)",
				jsonlogicCompatible: false,
				preserveRules: true,
			},
			eager: true,
		},
	)(operatorRegistry);
}

/**
 * Registers os_unique_map.
 */
export function registerOsUniqueMap(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, Rule, Rule, boolean?, Rule?], unknown[]>(
		"os_unique_map",
		{
			handler: (
				[arrayOrRule, asName, keyRule, valueRule, optional, whenRule],
				data,
				ctx,
			) => {
				const array = Array.isArray(arrayOrRule)
					? arrayOrRule
					: evaluateRule(arrayOrRule as Rule, data, buildEvalOpts(ctx));

				if (!Array.isArray(array)) {
					if (optional) return [];
					throw new Error(`os_unique_map: expected array, got ${typeof array}`);
				}

				const seen = new Set<string>();
				const results: unknown[] = [];

				for (const item of array) {
					const mergedData = {
						...(data as Record<string, unknown>),
						[asName]: item,
					};
					if (whenRule !== undefined) {
						const whenResult = evaluateRule(
							whenRule as Rule,
							mergedData,
							buildEvalOpts(ctx),
						);
						if (!isTruthy(whenResult, ctx.truthinessMode)) continue;
					}
					const key = evaluateRule(
						keyRule as Rule,
						mergedData,
						buildEvalOpts(ctx),
					);
					const keyStr = JSON.stringify(key);
					if (seen.has(keyStr)) continue;
					seen.add(keyStr);
					const result = evaluateRule(
						valueRule as Rule,
						mergedData,
						buildEvalOpts(ctx),
					);
					results.push(result);
				}
				return results;
			},
			inputSchema: z.union([
				z.tuple([z.any(), z.string(), z.any(), z.any()]),
				z.tuple([z.any(), z.string(), z.any(), z.any(), z.boolean()]),
				z.tuple([z.any(), z.string(), z.any(), z.any(), z.boolean(), z.any()]),
			]),
			outputSchema: z.array(z.any()),
			metadata: {
				name: "os_unique_map",
				title: "OS Unique Map",
				description:
					"Maps over an array, deduplicating by a key rule. For each unique key, evaluates a value rule.",
				category: "openspec",
				tags: ["openspec", "array", "dedup"],
				examples: [
					{
						description: "Unique map by id",
						input: {
							items: [
								{ id: "a", name: "Alice" },
								{ id: "a", name: "AliceDup" },
								{ id: "b", name: "Bob" },
							],
						},
						rule: {
							os_unique_map: [
								{ var: "items" },
								"item",
								{ var: "item.id" },
								{ var: "item.name" },
							],
						},
						output: ["Alice", "Bob"],
					},
				],
				complexity: "O(n)",
				jsonlogicCompatible: false,
				preserveRules: true,
			},
			eager: true,
		},
	)(operatorRegistry);
}

/**
 * Registers os_find.
 */
export function registerOsFind(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, Rule, boolean?], unknown>("os_find", {
		handler: ([arrayOrRule, asName, conditionRule, optional], data, ctx) => {
			const array = Array.isArray(arrayOrRule)
				? arrayOrRule
				: evaluateRule(arrayOrRule as Rule, data, buildEvalOpts(ctx));

			if (!Array.isArray(array)) {
				if (optional) return undefined;
				throw new Error(`os_find: expected array, got ${typeof array}`);
			}

			for (const item of array) {
				const mergedData = {
					...(data as Record<string, unknown>),
					[asName]: item,
				};
				const cond = evaluateRule(
					conditionRule as Rule,
					mergedData,
					buildEvalOpts(ctx),
				);
				if (isTruthy(cond, ctx.truthinessMode)) return item;
			}

			if (optional) return undefined;
			throw new Error("os_find: no matching item found");
		},
		inputSchema: z.union([
			z.tuple([z.any(), z.string(), z.any()]),
			z.tuple([z.any(), z.string(), z.any(), z.boolean()]),
		]),
		outputSchema: z.any(),
		metadata: {
			name: "os_find",
			title: "OS Find",
			description:
				"Finds the first item in an array where the condition rule is truthy, using flat scope merging.",
			category: "openspec",
			tags: ["openspec", "array", "search"],
			examples: [
				{
					description: "Find item by property",
					input: { items: [{ id: "a" }, { id: "b" }, { id: "c" }] },
					rule: {
						os_find: [
							{ var: "items" },
							"item",
							{ "==": [{ var: "item.id" }, "b"] },
						],
					},
					output: { id: "b" },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers os_object_from_entries.
 */
export function registerOsObjectFromEntries(
	operatorRegistry: OperatorRegistry,
) {
	defineSyncOperator<
		[unknown, string, Rule, Rule, boolean?, Rule?],
		Record<string, unknown>
	>("os_object_from_entries", {
		handler: (
			[arrayOrRule, asName, keyRule, valueRule, optional, whenRule],
			data,
			ctx,
		) => {
			const array = Array.isArray(arrayOrRule)
				? arrayOrRule
				: evaluateRule(arrayOrRule as Rule, data, buildEvalOpts(ctx));

			if (!Array.isArray(array)) {
				if (optional) return {};
				throw new Error(
					`os_object_from_entries: expected array, got ${typeof array}`,
				);
			}

			const result: Record<string, unknown> = {};

			for (const item of array) {
				const mergedData = {
					...(data as Record<string, unknown>),
					[asName]: item,
				};
				if (whenRule !== undefined) {
					const whenResult = evaluateRule(
						whenRule as Rule,
						mergedData,
						buildEvalOpts(ctx),
					);
					if (!isTruthy(whenResult, ctx.truthinessMode)) continue;
				}
				const key = evaluateRule(
					keyRule as Rule,
					mergedData,
					buildEvalOpts(ctx),
				);
				if (typeof key !== "string" || key === "") continue;
				const value = evaluateRule(
					valueRule as Rule,
					mergedData,
					buildEvalOpts(ctx),
				);
				result[key] = value;
			}
			return result;
		},
		inputSchema: z.union([
			z.tuple([z.any(), z.string(), z.any(), z.any()]),
			z.tuple([z.any(), z.string(), z.any(), z.any(), z.boolean()]),
			z.tuple([z.any(), z.string(), z.any(), z.any(), z.boolean(), z.any()]),
		]),
		outputSchema: z.record(z.string(), z.any()),
		metadata: {
			name: "os_object_from_entries",
			title: "OS Object From Entries",
			description:
				"Builds a record from an array by evaluating key and value rules for each item, using flat scope merging.",
			category: "openspec",
			tags: ["openspec", "object", "array"],
			examples: [
				{
					description: "Build object from array",
					input: {
						items: [
							{ key: "a", val: 1 },
							{ key: "b", val: 2 },
						],
					},
					rule: {
						os_object_from_entries: [
							{ var: "items" },
							"item",
							{ var: "item.key" },
							{ var: "item.val" },
						],
					},
					output: { a: 1, b: 2 },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers os_node_id.
 */
export function registerOsNodeId(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string, ...string[]], string>("os_node_id", {
		handler: ([factKind, ...segments]) => {
			const segStr = segments.join(".");
			return `${factKind}:${segStr}`;
		},
		inputSchema: z.tuple([z.string(), z.string()]).rest(z.string()),
		outputSchema: z.string(),
		metadata: {
			name: "os_node_id",
			title: "OS Node ID",
			description:
				'Constructs an OpenSpec node ID in the form "factKind:seg1.seg2.seg3".',
			category: "openspec",
			tags: ["openspec", "node-id"],
			examples: [
				{
					description: "Build a node ID",
					input: {},
					rule: { os_node_id: ["protocol.protocol", "myProtocol.v1"] },
					output: "protocol.protocol:myProtocol.v1",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
