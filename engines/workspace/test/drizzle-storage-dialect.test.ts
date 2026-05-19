import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createActionExecutorAdapter } from "@openspec/action-executor";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
import { drizzleSyntaxRenderAdapter } from "../../../dialects/drizzle/src/index.ts";
import { discoverWorkspaceDocuments } from "../src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

async function compileWorkspace(extraDocuments: unknown[] = []) {
	const { documents, diagnostics } = await discoverWorkspaceDocuments({
		root: REPO_ROOT,
	});
	expect(diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
	const result = await createCompiler({
		capabilities: {
			expressionEvaluator: createExpressoRuntime(),
		},
	}).compile({ documents: [...documents, ...extraDocuments] as never[] });
	expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
	return result;
}

describe("Drizzle storage dialect", () => {
	test("renders storage schema output from shared storage facts", async () => {
		const result = await compileWorkspace([
			{
				id: "drizzle.storage.entities",
				protocol: "openspec.entity.v1",
				document: {
					owner: "provider.provider:drizzle",
					entities: [
						{
							id: "account",
							name: "Account",
							fields: [
								{ name: "id", type: "string", required: true, identity: true, unique: true },
								{ name: "name", type: "string", required: true },
								{ name: "score", type: "number", required: false },
								{ name: "rollup", type: "number", required: false, computed: true },
							],
						},
						{
							id: "contact",
							name: "Contact",
							fields: [
								{ name: "id", type: "string", required: true, identity: true, unique: true },
								{ name: "email", type: "string", required: false },
							],
						},
					],
				},
			},
			{
				id: "drizzle.storage.relations",
				protocol: "openspec.relation.v1",
				document: {
					owner: "provider.provider:drizzle",
					relations: [
						{
							id: "account-contact",
							name: "contacts",
							from: "account",
							to: "contact",
							cardinality: "one-to-many",
							required: false,
						},
					],
				},
			},
			{
				id: "drizzle.storage.output",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "crm.test.drizzle",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:drizzle",
								id: "crm.test.drizzle",
								namespace: "crm.test.drizzle",
								dialect: "drizzle",
								artifact: {
									path: "docs/generated/crm.test.drizzle.ts",
									mediaType: "text/x.typescript",
								},
							},
						},
					],
				},
			},
		]);

		expect(result.runtime.node("provider.selection:crm.test.drizzle.renderer.drizzle.syntax.render")).toMatchObject({
			kind: "provider.selection",
			attributes: expect.objectContaining({
				dialect: "drizzle",
				adapter: "adapter.adapter:drizzle.syntax.render",
				projectionKind: "projection.syntax.render",
			}),
		});
		expect(result.graph.facets).toContainEqual(
			expect.objectContaining({
				kind: "drizzle.column",
				value: expect.objectContaining({
					name: "score",
					type: "real",
					nullable: true,
				}),
			}),
		);
		expect(result.graph.facets).not.toContainEqual(
			expect.objectContaining({
				kind: "drizzle.column",
				value: expect.objectContaining({ name: "rollup" }),
			}),
		);

		const renderInput = result.runtime.select("drizzle.syntaxRenderInput", {
			syntaxUnit: "syntax.unit:crm.test.drizzle.crm.test.drizzle",
			asset: "asset.asset:crm.test.drizzle.output",
		}) as { tables: Array<{ name: string; columns: unknown[] }>; relations: Array<{ name: string }> };
		expect(renderInput.tables.map((table) => table.name).sort()).toEqual(["Account", "Contact"]);
		expect(renderInput.tables.flatMap((table) => table.columns)).toHaveLength(5);
		expect(renderInput.relations.map((relation) => relation.name)).toEqual(["contacts"]);

		const focusedGraph = graphWithOnlyPlanningAction(
			result.graph,
			"docs/generated/crm.test.drizzle.ts",
		);
		const outputs = await createActionExecutorAdapter({
			adapters: [
				{
					id: "drizzle.syntax.render",
					kind: "projection.syntax.render",
					capability: "capability.capability:artifact.render",
					adapter: drizzleSyntaxRenderAdapter,
				},
			],
		}).execute({ root: REPO_ROOT, graph: focusedGraph, runtime: result.runtime });

		expect(outputs).toContainEqual(
			expect.objectContaining({
				location: "docs/generated/crm.test.drizzle.ts",
				content: expect.stringContaining('export const account = pgTable("account"'),
				disposition: "generated",
			}),
		);
		const output = outputs.find((item) => item.location === "docs/generated/crm.test.drizzle.ts");
		expect(output?.content).toContain('score: real("score")');
		expect(output?.content).not.toContain("rollup");
		expect(output?.content).toContain(
			'contactsId: text("contacts_id").references(() => contact.id)',
		);
	}, 20000);
});

function graphWithOnlyPlanningAction<TGraph extends { nodes: Array<{ kind: string; attributes?: unknown }> }>(
	graph: TGraph,
	artifactPath: string,
): TGraph {
	return {
		...graph,
		nodes: graph.nodes.filter((node) => {
			if (node.kind !== "planning.action") return true;
			return nodeAttributes(node).artifactPath === artifactPath;
		}),
	};
}

function nodeAttributes(node: { attributes?: unknown }): Record<string, unknown> {
	return typeof node.attributes === "object" && node.attributes !== null
		? (node.attributes as Record<string, unknown>)
		: {};
}
