import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

function transformObject(
	obj: Record<string, unknown>,
	keyTransform: string,
	valueTransform: string,
	recursive: unknown,
): Record<string, unknown> {
	const isRecursive = typeof recursive === "boolean" ? recursive : false;
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		let newKey = key;
		let newValue = value;

		if (keyTransform === "lowercase") newKey = key.toLowerCase();
		else if (keyTransform === "uppercase") newKey = key.toUpperCase();
		else if (keyTransform === "camelCase") {
			newKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
		} else if (keyTransform === "snake_case") {
			newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
		}

		if (valueTransform === "string") newValue = String(value);
		else if (valueTransform === "number") newValue = Number(value);

		if (
			isRecursive &&
			typeof newValue === "object" &&
			newValue !== null &&
			!Array.isArray(newValue)
		) {
			newValue = transformObject(
				newValue as Record<string, unknown>,
				keyTransform,
				valueTransform,
				recursive,
			);
		}

		result[newKey] = newValue;
	}
	return result;
}

/**
 * Registers transform.
 *
 * @returns The result produced by `registerTransform`.
 *
 * @example
 * registerTransform();
 */

export function registerTransform(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<
		[Record<string, unknown>, string, string, Record<string, unknown>?],
		Record<string, unknown>
	>("transform", {
		handler: ([obj, keyTransform, valueTransform, options]) => {
			if (typeof obj !== "object" || obj === null || Array.isArray(obj))
				return {};
			const { recursive = false } = options || {};
			return transformObject(obj, keyTransform, valueTransform, recursive);
		},
		inputSchema: z.union([
			z.tuple([z.record(z.string(), z.any()), z.string(), z.string()]),
			z.tuple([
				z.record(z.string(), z.any()),
				z.string(),
				z.string(),
				z.record(z.string(), z.any()),
			]),
		]),
		outputSchema: z.record(z.string(), z.any()),
		metadata: {
			name: "transform",
			title: "Transform",
			description:
				"Transform object keys and values according to specified rules",
			category: "object",
			tags: ["object", "transformation"],
			examples: [
				{
					description: "Convert keys to camelCase",
					input: {},
					rule: {
						transform: [
							{ user_name: "John", user_age: 25 },
							"camelCase",
							"none",
						],
					},
					output: { userName: "John", userAge: 25 },
				},
				{
					description: "Convert keys to snake_case",
					input: {},
					rule: {
						transform: [
							{ userName: "John", userAge: 25 },
							"snake_case",
							"none",
						],
					},
					output: { user_name: "John", user_age: 25 },
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
		eager: true,
	})(operatorRegistry);
}
