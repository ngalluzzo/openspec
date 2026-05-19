import type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";
import type {
	ZodFieldContract,
	ZodSyntaxRenderInput,
} from "./sdk/zod-dialect-types.generated.ts";
import {
	implementZodSyntaxRenderAdapter,
	type ZodSyntaxRenderAdapter,
} from "./sdk/zod-syntax-render.generated.ts";

export const zodSyntaxRenderAdapter: ZodSyntaxRenderAdapter =
	implementZodSyntaxRenderAdapter({
		async render(input): Promise<TextFileArtifactRecipe> {
			return {
				kind: "text.file",
				...(assetPath(input) ? { path: assetPath(input) } : {}),
				text: renderZodSchemas(input),
				mediaType: input.asset.mediaType ?? "text/x-typescript",
				disposition:
					input.asset.disposition === "scaffold" ? "scaffold" : "generated",
			};
		},
	});

function renderZodSchemas(input: ZodSyntaxRenderInput): string {
	const schemas = uniqueBy(input.schemas ?? [], (s) => s.storageEntity).sort(
		(a, b) => a.name.localeCompare(b.name),
	);

	if (schemas.length === 0) return 'import { z } from "zod";\n';

	const lines: string[] = ['import { z } from "zod";', ""];

	for (const schema of schemas) {
		const schemaName = camelCase(schema.name);
		const typeName = pascalCase(schema.name);
		const fields = uniqueBy(schema.fields ?? [], (f) => f.storageField).map(
			(field) => ({
				name: camelCase(field.name),
				expr: zodFieldExpression(field),
			}),
		);

		lines.push(`export const ${schemaName}Schema = z.object({`);
		for (const field of fields) {
			lines.push(`  ${field.name}: ${field.expr},`);
		}
		lines.push(`});`);
		lines.push(
			`export type ${typeName} = z.infer<typeof ${schemaName}Schema>;`,
		);
		lines.push("");
	}

	return lines.join("\n");
}

function zodFieldExpression(field: ZodFieldContract): string {
	const base = zodBaseType(field.type);
	return field.nullable && !field.identity ? `${base}.nullable()` : base;
}

function zodBaseType(type: string): string {
	switch (type) {
		case "string":
			return "z.string()";
		case "number":
			return "z.number()";
		case "number.int":
			return "z.number().int()";
		case "boolean":
			return "z.boolean()";
		case "date":
		case "datetime":
			return "z.date()";
		default:
			return "z.unknown()";
	}
}

function camelCase(value: string): string {
	const words = String(value ?? "")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	return [words[0]?.toLowerCase(), ...words.slice(1).map(capitalize)].join("");
}

function pascalCase(value: string): string {
	return String(value ?? "")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map(capitalize)
		.join("");
}

function capitalize(value: string): string {
	if (!value) return "";
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const item of items) {
		const id = key(item);
		if (seen.has(id)) continue;
		seen.add(id);
		result.push(item);
	}
	return result;
}

function assetPath(input: ZodSyntaxRenderInput): string | undefined {
	const locator = objectValue(input.asset.locator);
	return stringValue(locator?.path);
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
