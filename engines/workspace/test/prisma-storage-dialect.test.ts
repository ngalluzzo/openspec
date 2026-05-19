import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createActionExecutorAdapter } from "@openspec/action-executor";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
import { prismaSyntaxRenderAdapter } from "../../../dialects/prisma/src/index.ts";
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

describe("Prisma storage dialect", () => {
	test("renders storage schema output through provider-selected Prisma syntax", async () => {
		const result = await compileWorkspace([
			{
				id: "prisma.storage.entities",
				protocol: "openspec.entity.v1",
				document: {
					owner: "provider.provider:prisma",
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
				id: "prisma.storage.relations",
				protocol: "openspec.relation.v1",
				document: {
					owner: "provider.provider:prisma",
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
				id: "prisma.storage.output",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "crm.test.storage",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:prisma",
								id: "crm.test.storage",
								namespace: "crm.test.storage",
								dialect: "prisma",
								policy: {
									omitComputedFields: true,
								},
								target: {
									datasource: {
										provider: "postgresql",
										urlEnv: "DATABASE_URL",
									},
								},
								artifact: {
									path: "docs/generated/crm.test.prisma",
									mediaType: "text/x-prisma",
								},
							},
						},
					],
				},
			},
		]);

		expect(result.runtime.node("provider.selection:crm.test.storage.renderer.prisma.syntax.render")).toMatchObject({
			kind: "provider.selection",
			attributes: expect.objectContaining({
				dialect: "prisma",
				adapter: "adapter.adapter:prisma.syntax.render",
				projectionKind: "projection.syntax.render",
			}),
		});
		expect(result.graph.facets).toContainEqual(
			expect.objectContaining({
				kind: "prisma.field",
				value: expect.objectContaining({
					name: "score",
					type: "Float",
					nullable: true,
				}),
			}),
		);
		expect(result.graph.facets).not.toContainEqual(
			expect.objectContaining({
				kind: "prisma.field",
				value: expect.objectContaining({ name: "rollup" }),
			}),
		);

		const renderInput = result.runtime.select("prisma.syntaxRenderInput", {
			syntaxUnit: "syntax.unit:crm.test.storage.crm.test.storage",
			asset: "asset.asset:crm.test.storage.output",
		}) as { models: Array<{ name: string; fields: unknown[] }>; relations: Array<{ name: string }> };
		expect(renderInput.models.map((model) => model.name).sort()).toEqual(["Account", "Contact"]);
		expect(renderInput.models.flatMap((model) => model.fields)).toHaveLength(5);
		expect(renderInput.relations.map((relation) => relation.name)).toEqual(["contacts"]);

		expect(result.graph.nodes).toContainEqual(
			expect.objectContaining({
				kind: "planning.action",
				attributes: expect.objectContaining({
					artifactPath: "docs/generated/crm.test.prisma",
					projectionKind: "projection.syntax.render",
				}),
			}),
		);

		const prismaOutput = await prismaSyntaxRenderAdapter.render(renderInput as never);

		expect(prismaOutput.text).toContain("model Account {");
		expect(prismaOutput.text).toContain("  id String @id");
		expect(prismaOutput.text).toContain("  score Float?");
		expect(prismaOutput.text).not.toContain("rollup");
		expect(prismaOutput.text).toContain(
			'  contacts Contact? @relation("Contacts", fields: [contactsId], references: [id])',
		);
		expect(prismaOutput.text).toContain(
			'  accountContacts Account[] @relation("Contacts")',
		);

		const focusedGraph = graphWithOnlyPlanningAction(
			result.graph,
			"docs/generated/crm.test.prisma",
		);
		const outputs = await createActionExecutorAdapter({
			adapters: [
				{
					id: "prisma.syntax.render",
					kind: "projection.syntax.render",
					capability: "capability.capability:artifact.render",
					adapter: prismaSyntaxRenderAdapter,
				},
			],
		}).execute({ root: REPO_ROOT, graph: focusedGraph, runtime: result.runtime });
		expect(outputs).toContainEqual(
			expect.objectContaining({
				location: "docs/generated/crm.test.prisma",
				content: expect.stringContaining("model Account {"),
				disposition: "generated",
			}),
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
