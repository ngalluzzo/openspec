import type { OptionsSchema, OptionDef } from "./types.js";

/**
 * Validate and apply defaults to a raw options object against a schema.
 * Throws a descriptive error for missing required fields or type mismatches.
 */
export function resolveOptions<TOptions extends Record<string, unknown>>(
	schema: OptionsSchema<TOptions> | undefined,
	raw: Partial<TOptions> | undefined,
	recipeName: string,
): TOptions {
	if (!schema) return {} as TOptions;

	const resolved: Record<string, unknown> = {};
	const rawObj = raw ?? {};

	for (const [key, def] of Object.entries(schema) as [string, OptionDef][]) {
		const value = (rawObj as Record<string, unknown>)[key];

		if (value === undefined || value === null) {
			if (def.required && def.default === undefined) {
				throw new RecipeOptionsError(
					recipeName,
					`Required option "${key}" is missing`,
				);
			}
			resolved[key] = def.default;
			continue;
		}

		// Type check
		const typeErr = checkType(key, value, def.type);
		if (typeErr) throw new RecipeOptionsError(recipeName, typeErr);

		// Custom validator
		if (def.validate) {
			try {
				def.validate(value);
			} catch (err) {
				throw new RecipeOptionsError(
					recipeName,
					`Option "${key}" failed validation: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}

		resolved[key] = value;
	}

	return resolved as TOptions;
}

function checkType(key: string, value: unknown, type: string): string | null {
	switch (type) {
		case "string":
			return typeof value === "string"
				? null
				: `Option "${key}" must be a string, got ${typeof value}`;
		case "number":
			return typeof value === "number"
				? null
				: `Option "${key}" must be a number, got ${typeof value}`;
		case "boolean":
			return typeof value === "boolean"
				? null
				: `Option "${key}" must be a boolean, got ${typeof value}`;
		case "string[]":
			return Array.isArray(value) && value.every((v) => typeof v === "string")
				? null
				: `Option "${key}" must be a string[]`;
		case "json":
			return null;
		default:
			return null;
	}
}

export class RecipeOptionsError extends Error {
	constructor(recipeName: string, message: string) {
		super(`Recipe "${recipeName}": ${message}`);
		this.name = "RecipeOptionsError";
	}
}
