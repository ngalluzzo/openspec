import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isSafePathSegment(part: string): boolean {
	return part.length > 0 && !UNSAFE_PATH_SEGMENTS.has(part);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
	return Object.hasOwn(obj, key);
}

function getOwnValue(obj: Record<string, unknown>, key: string): unknown {
	if (!hasOwn(obj, key)) {
		return undefined;
	}
	return Object.getOwnPropertyDescriptor(obj, key)?.value;
}

function deepGet(obj: unknown, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (!isSafePathSegment(part)) return undefined;
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;
		if (Array.isArray(current)) {
			const index = parseInt(part, 10);
			if (Number.isNaN(index)) return undefined;
			current = (current as readonly unknown[]).at(index);
		} else {
			const record = current as Record<string, unknown>;
			current = getOwnValue(record, part);
			if (current === undefined) return undefined;
		}
	}
	return current;
}

/**
 * Registers get.
 *
 * @returns The result produced by `registerGet`.
 *
 * @example
 * registerGet();
 */

export function registerGet(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string, unknown?], unknown>("get", {
		handler: ([obj, path, defaultValue]) => {
			const value = deepGet(obj, path);
			return value !== undefined ? value : defaultValue;
		},
		inputSchema: z.union([
			z.tuple([z.any(), z.string()]),
			z.tuple([z.any(), z.string(), z.any()]),
		]),
		outputSchema: z.any(),
		metadata: {
			name: "get",
			title: "Get",
			description:
				"Get a value from a nested object by path with optional default",
			category: "object",
			tags: ["object", "properties", "data-access"],
			examples: [
				{
					description: "Get nested property",
					input: {},
					rule: {
						get: [{ user: { profile: { name: "John" } } }, "user.profile.name"],
					},
					output: "John",
				},
				{
					description: "Get with default value",
					input: {},
					rule: {
						get: [
							{ user: { name: "John" } },
							"user.email",
							"default@example.com",
						],
					},
					output: "default@example.com",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}

function deepSet(
	obj: Record<string, unknown>,
	path: string,
	value: unknown,
): void {
	const parts = path.split(".");
	let current: Record<string, unknown> = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		if (!part) continue;
		if (!isSafePathSegment(part)) return;
		if (
			!hasOwn(current, part) ||
			typeof getOwnValue(current, part) !== "object" ||
			getOwnValue(current, part) === null ||
			Array.isArray(getOwnValue(current, part))
		) {
			current[part] = Object.create(null) as Record<string, unknown>;
		}
		const next = getOwnValue(current, part);
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			return;
		}
		current = next as Record<string, unknown>;
	}
	const lastPart = parts[parts.length - 1];
	if (lastPart && isSafePathSegment(lastPart)) {
		current[lastPart] = value;
	}
}

/**
 * Registers set.
 *
 * @returns The result produced by `registerSet`.
 *
 * @example
 * registerSet();
 */

export function registerSet(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<
		[Record<string, unknown>, string, unknown],
		Record<string, unknown>
	>("set", {
		handler: ([obj, path, value]) => {
			const result = JSON.parse(JSON.stringify(obj));
			deepSet(result, path, value);
			return result;
		},
		inputSchema: z.tuple([z.record(z.string(), z.any()), z.string(), z.any()]),
		outputSchema: z.record(z.string(), z.any()),
		metadata: {
			name: "set",
			title: "Set",
			description:
				"Set a value at a nested path in an object (creates new object)",
			category: "object",
			tags: ["object", "properties", "transformation"],
			examples: [
				{
					description: "Set nested property",
					input: {},
					rule: { set: [{ user: { name: "John" } }, "user.age", 25] },
					output: { user: { name: "John", age: 25 } },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers has.
 *
 * @returns The result produced by `registerHas`.
 *
 * @example
 * registerHas();
 */

export function registerHas(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, string], boolean>("has", {
		handler: ([obj, path]) => {
			return deepGet(obj, path) !== undefined;
		},
		inputSchema: z.tuple([z.any(), z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "has",
			title: "Has",
			description: "Check if a nested path exists in an object",
			category: "object",
			tags: ["object", "properties", "validation"],
			examples: [
				{
					description: "Check if path exists",
					input: {},
					rule: { has: [{ user: { name: "John" } }, "user.name"] },
					output: true,
				},
				{
					description: "Check if path does not exist",
					input: {},
					rule: { has: [{ user: { name: "John" } }, "user.email"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}
