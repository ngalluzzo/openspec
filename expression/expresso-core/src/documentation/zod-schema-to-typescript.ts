import { z } from "zod";

const MAX_DEPTH = 4;

function toSchema(value: unknown): z.ZodTypeAny | undefined {
	return value && typeof value === "object"
		? (value as z.ZodTypeAny)
		: undefined;
}

function schemaDef(schema: z.ZodTypeAny): {
	type?: string;
	[key: string]: unknown;
} {
	return (
		(schema as unknown as { def?: { type?: string; [key: string]: unknown } })
			.def ?? {}
	);
}

function formatObjectShape(
	shape: Record<string, unknown>,
	depth: number,
): string {
	const entries = Object.entries(shape);
	if (entries.length === 0) {
		return "{}";
	}

	const fields = entries.map(([key, value]) => {
		const schema = toSchema(value);
		const fieldType =
			schema !== undefined
				? zodSchemaToTypescript(schema, depth + 1)
				: "unknown";
		return `${JSON.stringify(key)}: ${fieldType}`;
	});
	return `{ ${fields.join("; ")} }`;
}

/**
 * Executes `zodSchemaToTypescript` with the provided inputs.
 *
 * @param schema - The `schema` argument value.
 * @param depth - The `depth` argument value.
 *
 * @returns The result produced by `zodSchemaToTypescript`.
 *
 * @example
 * zodSchemaToTypescript(schema, depth);
 */

export function zodSchemaToTypescript(schema: z.ZodTypeAny, depth = 0): string {
	if (depth >= MAX_DEPTH) {
		return "unknown";
	}

	if (schema instanceof z.ZodString) return "string";
	if (schema instanceof z.ZodNumber) return "number";
	if (schema instanceof z.ZodBoolean) return "boolean";
	if (schema instanceof z.ZodBigInt) return "bigint";
	if (schema instanceof z.ZodNull) return "null";
	if (schema instanceof z.ZodUndefined) return "undefined";
	if (schema instanceof z.ZodVoid) return "void";
	if (schema instanceof z.ZodAny) return "any";
	if (schema instanceof z.ZodUnknown) return "unknown";
	if (schema instanceof z.ZodNever) return "never";

	if (schema instanceof z.ZodLiteral) {
		return JSON.stringify((schema as { value: unknown }).value);
	}

	if (schema instanceof z.ZodEnum) {
		const entries = schemaDef(schema).entries as
			| Record<string, string>
			| undefined;
		const options = entries ? Object.values(entries) : [];
		return options.map((value) => JSON.stringify(value)).join(" | ");
	}

	if (schema instanceof z.ZodArray) {
		const element = toSchema(schemaDef(schema).element);
		const elementType =
			element !== undefined
				? zodSchemaToTypescript(element, depth + 1)
				: "unknown";
		return `readonly ${elementType}[]`;
	}

	if (schema instanceof z.ZodTuple) {
		const items = (
			(schemaDef(schema).items as readonly unknown[] | undefined) ?? []
		).map((item) => {
			const itemSchema = toSchema(item);
			return itemSchema !== undefined
				? zodSchemaToTypescript(itemSchema, depth + 1)
				: "unknown";
		});
		return `[${items.join(", ")}]`;
	}

	if (schema instanceof z.ZodUnion) {
		const options =
			(schemaDef(schema).options as readonly unknown[] | undefined) ?? [];
		return options
			.map((option) => {
				const optionSchema = toSchema(option);
				return optionSchema !== undefined
					? zodSchemaToTypescript(optionSchema, depth + 1)
					: "unknown";
			})
			.join(" | ");
	}

	if (schema instanceof z.ZodOptional) {
		const inner = toSchema(schemaDef(schema).innerType);
		return `${inner !== undefined ? zodSchemaToTypescript(inner, depth + 1) : "unknown"} | undefined`;
	}

	if (schema instanceof z.ZodNullable) {
		const inner = toSchema(schemaDef(schema).innerType);
		return `${inner !== undefined ? zodSchemaToTypescript(inner, depth + 1) : "unknown"} | null`;
	}

	if (schema instanceof z.ZodRecord) {
		const valueType = toSchema(
			schemaDef(schema).valueType ?? schemaDef(schema).valueSchema,
		);
		const rendered =
			valueType !== undefined
				? zodSchemaToTypescript(valueType, depth + 1)
				: "unknown";
		return `Record<string, ${rendered}>`;
	}

	if (schema instanceof z.ZodObject) {
		const shape = (schemaDef(schema).shape ?? {}) as Record<string, unknown>;
		return formatObjectShape(shape, depth);
	}

	if (schema instanceof z.ZodDefault) {
		const inner = toSchema(schemaDef(schema).innerType);
		return inner !== undefined
			? zodSchemaToTypescript(inner, depth + 1)
			: "unknown";
	}

	return "unknown";
}
