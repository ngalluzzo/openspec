import type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";
import type {
	PrismaFieldContract,
	PrismaModelContract,
	PrismaRelationContract,
	PrismaSyntaxRenderInput,
} from "./sdk/prisma-dialect-types.generated.ts";
import {
	implementPrismaSyntaxRenderAdapter,
	type PrismaSyntaxRenderAdapter,
} from "./sdk/prisma-syntax-render.generated.ts";

export const prismaSyntaxRenderAdapter: PrismaSyntaxRenderAdapter =
	implementPrismaSyntaxRenderAdapter({
		async render(input): Promise<TextFileArtifactRecipe> {
			return {
				kind: "text.file",
				...(assetPath(input) ? { path: assetPath(input) } : {}),
				text: renderPrismaSchema(input),
				mediaType: input.asset.mediaType ?? "text/x-prisma",
				disposition: input.asset.disposition === "scaffold" ? "scaffold" : "generated",
			};
		},
	});

function renderPrismaSchema(input: PrismaSyntaxRenderInput): string {
	const options = prismaOptions(input);
	const models = uniqueBy(input.models ?? [], (model) => model.storageEntity)
		.map((model) => ({
			...model,
			name: prismaIdentifier(model.name, "Model"),
			fields: uniqueBy(model.fields ?? [], (field) => field.storageField).map(
				(field) => ({
					...field,
					name: prismaIdentifier(field.name, "field", "field"),
					type: prismaType(field.type),
				}),
			),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
	const modelByEntity = new Map(models.map((model) => [model.storageEntity, model]));
	const relations = uniqueBy(input.relations ?? [], (relation) => relation.storageRelation)
		.map((relation) => normalizeRelation(relation, modelByEntity))
		.filter((relation): relation is NormalizedRelation => relation !== undefined)
		.sort((a, b) => a.name.localeCompare(b.name));

	const blocks = [
		renderGenerator(options.generatorProvider),
		renderDatasource(options.datasourceProvider, options.datasourceUrlEnv),
		...models.map((model) => renderModel(model, relations)),
	];
	return `${blocks.join("\n\n")}\n`;
}

type RenderModel = PrismaModelContract & { fields: PrismaFieldContract[] };

type NormalizedRelation = {
	id: string;
	name: string;
	from: RenderModel;
	to: RenderModel;
	fieldName: string;
	inverseFieldName: string;
	fkName: string;
	references: PrismaFieldContract;
	required: boolean;
};

function renderGenerator(provider: string): string {
	return [`generator client {`, `  provider = ${quote(provider)}`, `}`].join("\n");
}

function renderDatasource(provider: string, urlEnv: string): string {
	return [
		`datasource db {`,
		`  provider = ${quote(provider)}`,
		`  url      = env(${quote(urlEnv)})`,
		`}`,
	].join("\n");
}

function renderModel(model: RenderModel, relations: NormalizedRelation[]): string {
	const lines = [`model ${model.name} {`];
	const used = new Set<string>();
	for (const field of model.fields) {
		used.add(field.name);
		lines.push(`  ${renderScalarField(field)}`);
	}
	for (const relation of relations.filter((item) => item.from === model)) {
		const fkName = uniqueName(relation.fkName, used);
		used.add(fkName);
		const relationFieldName = uniqueName(relation.fieldName, used);
		used.add(relationFieldName);
		lines.push(
			`  ${fkName} ${relation.references.type}${relation.required ? "" : "?"}`,
			`  ${relationFieldName} ${relation.to.name}${relation.required ? "" : "?"} @relation(${quote(relation.name)}, fields: [${fkName}], references: [${relation.references.name}])`,
		);
	}
	for (const relation of relations.filter((item) => item.to === model)) {
		const inverseName = uniqueName(relation.inverseFieldName, used);
		used.add(inverseName);
		lines.push(`  ${inverseName} ${relation.from.name}[] @relation(${quote(relation.name)})`);
	}
	lines.push("}");
	return lines.join("\n");
}

function renderScalarField(field: PrismaFieldContract): string {
	const attributes = [
		field.identity ? "@id" : undefined,
		!field.identity && field.unique ? "@unique" : undefined,
	].filter(Boolean);
	return [
		field.name,
		`${field.type}${field.nullable && !field.identity ? "?" : ""}`,
		...attributes,
	].join(" ");
}

function normalizeRelation(
	relation: PrismaRelationContract,
	modelByEntity: Map<string, RenderModel>,
): NormalizedRelation | undefined {
	const from = modelByEntity.get(relation.from);
	const to = modelByEntity.get(relation.to);
	if (!from || !to) return undefined;
	const references = to.fields.find((field) => field.identity) ?? to.fields[0];
	if (!references) return undefined;
	const fieldName = prismaIdentifier(relation.name, "relation", "field");
	return {
		id: relation.storageRelation,
		name: prismaIdentifier(relation.name || relation.storageRelation, "Relation"),
		from,
		to,
		fieldName,
		inverseFieldName: prismaIdentifier(`${from.name} ${fieldName}`, "relation", "field"),
		fkName: prismaIdentifier(`${fieldName} id`, "field", "field"),
		references,
		required: relation.required === true,
	};
}

function prismaOptions(input: PrismaSyntaxRenderInput): {
	datasourceProvider: string;
	datasourceUrlEnv: string;
	generatorProvider: string;
} {
	const target = objectValue(objectValue(input.unit.metadata)?.target);
	const datasource = objectValue(target?.datasource);
	const generator = objectValue(target?.generator);
	return {
		datasourceProvider: stringValue(datasource?.provider) ?? "postgresql",
		datasourceUrlEnv: stringValue(datasource?.urlEnv) ?? "DATABASE_URL",
		generatorProvider: stringValue(generator?.provider) ?? "prisma-client-js",
	};
}

function prismaType(value: string): string {
	switch (value) {
		case "String":
		case "Int":
		case "Float":
		case "Boolean":
		case "DateTime":
		case "Json":
		case "Bytes":
			return value;
		default:
			return "String";
	}
}

function prismaIdentifier(
	value: string | undefined,
	fallback: string,
	style: "model" | "field" = "model",
): string {
	const words = String(value ?? "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
	const normalized = words.length > 0 ? words : [fallback];
	const name =
		style === "field"
			? [normalized[0]?.toLowerCase(), ...normalized.slice(1).map(capitalize)].join("")
			: normalized.map(capitalize).join("");
	const safe = name.replace(/^[^A-Za-z_]+/, "");
	return safe.length > 0 ? safe : fallback;
}

function capitalize(value: string | undefined): string {
	if (!value) return "";
	return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function uniqueName(name: string, used: Set<string>): string {
	if (!used.has(name)) return name;
	let index = 2;
	while (used.has(`${name}${index}`)) index += 1;
	return `${name}${index}`;
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

function assetPath(input: PrismaSyntaxRenderInput): string | undefined {
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

function quote(value: string): string {
	return JSON.stringify(value);
}
