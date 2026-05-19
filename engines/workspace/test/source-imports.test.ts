import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
import { typescriptSyntaxRenderAdapter } from "../../../dialects/typescript/src/index.ts";
import { discoverWorkspaceDocuments } from "../src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

async function compileWorkspace(extraDocuments: unknown[] = []) {
	const { documents, diagnostics } = await discoverWorkspaceDocuments({
		root: REPO_ROOT,
	});
	expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
	const result = await createCompiler({
		capabilities: {
			expressionEvaluator: createExpressoRuntime(),
		},
	}).compile({ documents: [...documents, ...extraDocuments] as never[] });
	expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
	return result;
}

describe("faithful source imports", () => {
	test("Knack object wrapper emits native origins and normalized facts", async () => {
		const result = await compileWorkspace();
		const { edges, facets, nodes } = result.graph;

		expect(countNodes(nodes, "origin.origin", "origin.origin:knack.crm")).toBe(1);
		expect(countNodes(nodes, "origin.element", "origin.element:knack.crm.object.")).toBe(8);
		expect(countNodes(nodes, "origin.element", "origin.element:knack.crm.field.")).toBe(78);
		expect(countNodes(nodes, "origin.element", "origin.element:knack.crm.connection.")).toBe(7);
		expect(countNodes(nodes, "entity.declaration", "entity:knack.crm.")).toBe(8);
		expect(countNodes(nodes, "entity.field", "entity:knack.crm.")).toBe(71);
		expect(countNodes(nodes, "relation.declaration", "relation:knack.crm.")).toBe(7);
		expect(countEdges(edges, "relation.endpoint.from", "relation:knack.crm.")).toBe(7);
		expect(countEdges(edges, "relation.endpoint.to", "relation:knack.crm.")).toBe(7);

		const objectKeys = originNativeIds(nodes, "origin.element:knack.crm.object.");
		for (let index = 1; index <= 8; index += 1) {
			expect(objectKeys).toContain(`object_${index}`);
		}

		const fieldKeys = originNativeIds(nodes, "origin.element:knack.crm.field.");
		for (let index = 1; index <= 78; index += 1) {
			expect(fieldKeys).toContain(`field_${index}`);
		}

		expect(facets).toContainEqual(
			expect.objectContaining({
				kind: "knack.object.key",
				target: "entity:knack.crm.accounts",
				value: "object_1",
			}),
		);
		expect(result.runtime.node("model:origin.origin:knack.crm.KnackCrmAccountsRecord")).toBeTruthy();
	}, 15000);

	test("Postgres schema wrapper emits native origins and normalized facts", async () => {
		const result = await compileWorkspace();
		const { edges, facets, nodes } = result.graph;

		expect(countNodes(nodes, "origin.origin", "origin.origin:postgres.crm")).toBe(1);
		expect(countNodes(nodes, "origin.element", "origin.element:postgres.crm.table.")).toBe(8);
		expect(countNodes(nodes, "origin.element", "origin.element:postgres.crm.column.")).toBe(7);
		expect(countNodes(nodes, "entity.declaration", "entity:postgres.crm.")).toBe(8);
		expect(countNodes(nodes, "entity.field", "entity:postgres.crm.")).toBe(8);
		expect(countNodes(nodes, "relation.declaration", "relation:postgres.crm.")).toBe(7);
		expect(countEdges(edges, "relation.endpoint.from", "relation:postgres.crm.")).toBe(7);
		expect(countEdges(edges, "relation.endpoint.to", "relation:postgres.crm.")).toBe(7);

		expect(originNativeIds(nodes, "origin.element:postgres.crm.table.")).toEqual(
			expect.arrayContaining([
				"Accounts",
				"Administrators",
				"Contacts",
				"FollowUps",
				"Interactions",
				"Leads",
				"Managers",
				"SalesReps",
			]),
		);
		expect(
			nodes
				.filter((node) => node.id.startsWith("origin.element:postgres.crm.column."))
				.map((node) => (node.attributes as { metadata?: { raw?: { references?: string } } }).metadata?.raw?.references)
				.filter(Boolean),
		).toEqual(
			expect.arrayContaining(["Contacts", "SalesReps", "Leads", "Managers"]),
		);
		expect(facets.filter((facet) => facet.kind === "import.synthetic" && facet.id.startsWith("facet:postgres.crm.synthetic-id."))).toHaveLength(8);
		const postgresIdentityFields = nodes.filter(
			(node) =>
				node.kind === "entity.field" &&
				node.id.startsWith("entity:postgres.crm.") &&
				node.id.endsWith(".field.id"),
		);
		expect(
			postgresIdentityFields.filter(
				(field) =>
					!edges.some(
						(edge) => edge.kind === "origin.lineage" && edge.from === field.id,
					),
			),
		).toEqual([]);
		expect(result.runtime.node("model:origin.origin:postgres.crm.PostgresCrmSalesRepsRecord")).toBeTruthy();
	}, 15000);

	test("imported entity facts can render through the existing TypeScript renderer", async () => {
		const result = await compileWorkspace();
		expect(result.runtime.hasSelector("model.declarationsForOwner")).toBe(true);
		const declarations = result.runtime.select("model.declarationsForOwner", {
			owner: "origin.origin:knack.crm",
		}) as Array<{
			name: string;
			fields?: Array<{ name: string; type: string; required?: boolean }>;
		}>;
		const accounts = declarations.find(
			(declaration) => declaration.name === "KnackCrmAccountsRecord",
		);
		expect(accounts?.fields?.length).toBeGreaterThan(0);

		const recipe = await typescriptSyntaxRenderAdapter.render({
			unit: {
				id: "source.knack.crm.types",
				kind: "model.type.surface",
				role: "model.type.surface",
			},
			asset: {
				locator: { kind: "local.file", path: "src/generated/source-knack-crm.types.ts" },
				disposition: "generated",
			},
			declarations: [
				{
					id: "source.knack.crm.types.KnackCrmAccountsRecord",
					target: "model:origin.origin:knack.crm.KnackCrmAccountsRecord",
					value: {
						kind: "typeAlias",
						name: "KnackCrmAccountsRecord",
						exported: true,
						type: {
							kind: "object",
							properties: (accounts?.fields ?? []).map((field) => ({
								name: field.name,
								optional: field.required === false,
								type: { kind: "keyword", name: field.type },
							})),
						},
					},
				},
			],
		});

		expect(recipe).toMatchObject({
			kind: "text.file",
			path: "src/generated/source-knack-crm.types.ts",
			mediaType: "text/x.typescript",
			disposition: "generated",
		});
		expect(recipe.text).toContain("export type KnackCrmAccountsRecord =");
		expect(recipe.text).toContain("id: string");
	}, 15000);

	test("Knack source import preserves duplicate labels with native-key graph identities", async () => {
		const result = await compileWorkspace([
			{
				id: "source.knack.duplicate.objects",
				protocol: "openspec.source.knack.objects.v1",
				document: {
					owner: "origin.origin:knack.duplicate",
					sourceId: "knack.duplicate",
					source: { path: "inline.json", mediaType: "application/json" },
					snapshot: {
						application: {
							objects: [
								{
									key: "object_1",
									name: "Accounts",
									fields: [
										{ key: "field_1", name: "Name", type: "short_text" },
										{ key: "field_2", name: "Name", type: "short_text" },
									],
									connections: {
										outbound: [
											{
												key: "field_10",
												name: "Owner",
												object: "object_2",
												has: "one",
												belongs_to: "one",
											},
											{
												key: "field_11",
												name: "Owner",
												object: "object_2",
												has: "many",
												belongs_to: "many",
											},
										],
									},
								},
								{
									key: "object_2",
									name: "Owners",
									fields: [],
									connections: { outbound: [] },
								},
							],
						},
					},
				},
			},
		]);

		expect(
			result.graph.nodes.filter((node) =>
				node.id.startsWith("entity:knack.duplicate.accounts.field.name."),
			),
		).toHaveLength(2);
		expect(
			result.graph.nodes
				.filter((node) => node.kind === "relation.declaration" && node.id.startsWith("relation:knack.duplicate."))
				.map((node) => node.attributes),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ cardinality: "one-to-one", via: "field_10" }),
				expect.objectContaining({ cardinality: "many-to-many", via: "field_11" }),
			]),
		);
	}, 15000);

	test("source protocols validate owner/sourceId consistency", async () => {
		const { documents, diagnostics } = await discoverWorkspaceDocuments({
			root: REPO_ROOT,
		});
		expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		const result = await createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
			},
		}).compile({
			documents: [
				...documents,
				{
					id: "source.knack.mismatch.objects",
					protocol: "openspec.source.knack.objects.v1",
					document: {
						owner: "origin.origin:knack.one",
						sourceId: "knack.two",
						source: { path: "inline.json", mediaType: "application/json" },
						snapshot: { application: { objects: [] } },
					},
				},
			] as never[],
		});

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					severity: "error",
					code: "source.knack.objects.ownerSourceId.mismatch",
				}),
			]),
		);
	}, 15000);
});

function countNodes(
	nodes: Array<{ id: string; kind: string }>,
	kind: string,
	prefix: string,
): number {
	return nodes.filter((node) => node.kind === kind && node.id.startsWith(prefix))
		.length;
}

function countEdges(
	edges: Array<{ id: string; kind: string }>,
	kind: string,
	prefix: string,
): number {
	return edges.filter((edge) => edge.kind === kind && edge.id.startsWith(prefix))
		.length;
}

function originNativeIds(
	nodes: Array<{ id: string; kind: string; attributes?: unknown }>,
	prefix: string,
): string[] {
	return nodes
		.filter((node) => node.kind === "origin.element" && node.id.startsWith(prefix))
		.map((node) => (node.attributes as { nativeId?: string }).nativeId)
		.filter((value): value is string => typeof value === "string");
}
