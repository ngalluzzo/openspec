import type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";
import type {
	DrizzleColumnContract,
	DrizzleRelationContract,
	DrizzleSyntaxRenderInput,
	DrizzleTableContract,
} from "./sdk/drizzle-dialect-types.generated.ts";
import {
	implementDrizzleSyntaxRenderAdapter,
	type DrizzleSyntaxRenderAdapter,
} from "./sdk/drizzle-syntax-render.generated.ts";

export const drizzleSyntaxRenderAdapter: DrizzleSyntaxRenderAdapter =
	implementDrizzleSyntaxRenderAdapter({
		async render(input): Promise<TextFileArtifactRecipe> {
			return {
				kind: "text.file",
				...(assetPath(input) ? { path: assetPath(input) } : {}),
				text: renderDrizzleSchema(input),
				mediaType: input.asset.mediaType ?? "text/x.typescript",
				disposition: input.asset.disposition === "scaffold" ? "scaffold" : "generated",
			};
		},
	});

function renderDrizzleSchema(input: DrizzleSyntaxRenderInput): string {
	const tables = uniqueBy(input.tables ?? [], (table) => table.storageEntity)
		.map((table) => ({
			...table,
			variableName: camelCase(table.name),
			tableName: snakeCase(table.name),
			columns: uniqueBy(table.columns ?? [], (column) => column.storageField).map(
				(column) => ({
					...column,
					propertyName: camelCase(column.name),
					columnName: snakeCase(column.name),
					type: drizzleType(column.type),
				}),
			),
		}))
		.sort((a, b) => a.variableName.localeCompare(b.variableName));
	const tableByEntity = new Map(tables.map((table) => [table.storageEntity, table]));
	const relations = uniqueBy(input.relations ?? [], (relation) => relation.storageRelation)
		.map((relation) => normalizeRelation(relation, tableByEntity))
		.filter((relation): relation is NormalizedRelation => relation !== undefined)
		.sort((a, b) => a.propertyName.localeCompare(b.propertyName));
	const imports = sortedImports(tables, relations);
	const lines = [
		`import { ${imports.join(", ")} } from "drizzle-orm/pg-core";`,
		"",
	];

	for (const table of tables) {
		lines.push(`export const ${table.variableName} = pgTable("${table.tableName}", {`);
		const used = new Set(table.columns.map((column) => column.propertyName));
		for (const column of table.columns) {
			lines.push(`  ${column.propertyName}: ${renderColumn(column)},`);
		}
		for (const relation of relations.filter((item) => item.from === table)) {
			const propertyName = uniqueName(`${relation.propertyName}Id`, used);
			used.add(propertyName);
			lines.push(`  ${propertyName}: ${renderRelationColumn(relation)},`);
		}
		lines.push("});", "");
	}

	return lines.join("\n");
}

type RenderColumn = DrizzleColumnContract & {
	propertyName: string;
	columnName: string;
	type: string;
};

type RenderTable = DrizzleTableContract & {
	variableName: string;
	tableName: string;
	columns: RenderColumn[];
};

type NormalizedRelation = {
	from: RenderTable;
	to: RenderTable;
	propertyName: string;
	columnName: string;
	references: RenderColumn;
	required: boolean;
};

function renderColumn(column: RenderColumn): string {
	const calls = [
		`${column.type}("${column.columnName}")`,
		column.identity ? "primaryKey()" : undefined,
		!column.nullable ? "notNull()" : undefined,
		!column.identity && column.unique ? "unique()" : undefined,
	].filter(Boolean);
	return calls.join(".");
}

function renderRelationColumn(relation: NormalizedRelation): string {
	const calls = [
		`${relation.references.type}("${relation.columnName}")`,
		relation.required ? "notNull()" : undefined,
		`references(() => ${relation.to.variableName}.${relation.references.propertyName})`,
	].filter(Boolean);
	return calls.join(".");
}

function normalizeRelation(
	relation: DrizzleRelationContract,
	tableByEntity: Map<string, RenderTable>,
): NormalizedRelation | undefined {
	const from = tableByEntity.get(relation.from);
	const to = tableByEntity.get(relation.to);
	if (!from || !to) return undefined;
	const references = to.columns.find((column) => column.identity) ?? to.columns[0];
	if (!references) return undefined;
	const propertyName = camelCase(relation.name || relation.storageRelation);
	return {
		from,
		to,
		propertyName,
		columnName: `${snakeCase(propertyName)}_id`,
		references,
		required: relation.required === true,
	};
}

function sortedImports(tables: RenderTable[], relations: NormalizedRelation[]): string[] {
	const imports = new Set<string>(["pgTable"]);
	for (const table of tables) {
		for (const column of table.columns) imports.add(column.type);
	}
	for (const relation of relations) imports.add(relation.references.type);
	return [...imports].sort((a, b) => a.localeCompare(b));
}

function drizzleType(value: string): string {
	switch (value) {
		case "integer":
			return "integer";
		case "real":
		case "number":
		case "float":
			return "real";
		case "boolean":
			return "boolean";
		case "timestamp":
		case "date":
		case "datetime":
			return "timestamp";
		default:
			return "text";
	}
}

function camelCase(value: string): string {
	const words = wordsFrom(value);
	return [words[0]?.toLowerCase(), ...words.slice(1).map(capitalize)].join("") || "field";
}

function snakeCase(value: string): string {
	return wordsFrom(value).map((word) => word.toLowerCase()).join("_") || "field";
}

function wordsFrom(value: string): string[] {
	return String(value ?? "")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean);
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

function assetPath(input: DrizzleSyntaxRenderInput): string | undefined {
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
