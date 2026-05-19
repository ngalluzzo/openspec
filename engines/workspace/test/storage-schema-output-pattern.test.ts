import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
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

describe("storage schema output pattern", () => {
	test("creates a storage syntax surface and routes rendering through provider selection", async () => {
		const result = await compileWorkspace([
			{
				id: "test-storage-render-provider",
				protocol: "openspec.provider.v1",
				document: {
					owner: "provider.provider:test-storage",
					providers: [
						{
							id: "test-storage",
							name: "Test Storage Renderer",
							exports: {
								adapters: ["adapter.adapter:test-storage.syntax.render"],
							},
						},
					],
					offerings: [
						{
							id: "test-storage.syntax.render",
							provider: "provider.provider:test-storage",
							role: "module.render",
							dialect: "test-storage",
							adapter: "adapter.adapter:test-storage.syntax.render",
							projectionKind: "projection.syntax.render",
							params: {
								dialect: "test-storage",
							},
						},
					],
				},
			},
			{
				id: "test-storage-render-adapter",
				protocol: "openspec.adapter.v1",
				document: {
					owner: "provider.provider:test-storage",
					adapters: [
						{
							id: "test-storage.syntax.render",
							capability: "capability.capability:artifact.render",
							kind: "projection.syntax.render",
							params: {
								dialect: "test-storage",
							},
						},
					],
				},
			},
			{
				id: "crm-storage-schema-output",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "crm.storage",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "schema.workspace:crm",
								id: "crm.storage",
								namespace: "crm.storage",
								subject: "schema.workspace:crm",
								dialect: "test-storage",
								policy: {
									includeSourceOnlyFields: false,
									omitComputedFields: true,
								},
								artifact: {
									path: "docs/generated/crm.storage",
									mediaType: "text/plain",
								},
							},
						},
					],
				},
			},
		]);

		expect(result.runtime.node("pattern.declaration:storage.schema-output")).toBeTruthy();
		expect(result.runtime.node("syntax.unit:crm.storage.crm.storage")).toMatchObject({
			kind: "syntax.unit",
			attributes: expect.objectContaining({
				id: "crm.storage",
				namespace: "crm.storage",
				owner: "schema.workspace:crm",
				role: "storage.schema.surface",
				kind: "storage.schema.surface",
				subject: "schema.workspace:crm",
			}),
		});
		expect(result.runtime.node("provider.selection:crm.storage.renderer.test-storage.syntax.render")).toMatchObject({
			kind: "provider.selection",
			attributes: expect.objectContaining({
				request: "crm.storage.renderer",
				target: "syntax.unit:crm.storage.crm.storage",
				dialect: "test-storage",
				adapter: "adapter.adapter:test-storage.syntax.render",
				projectionKind: "projection.syntax.render",
			}),
		});
		expect(
			result.graph.nodes
				.filter((node) => node.kind === "planning.action")
				.map((node) => node.attributes),
		).toContainEqual(
			expect.objectContaining({
				id: "crm.storage",
				owner: "schema.workspace:crm",
				capability: "capability.capability:artifact.render",
				adapterId: "test-storage.syntax.render",
				projectionKind: "projection.syntax.render",
				artifactPath: "docs/generated/crm.storage",
				projectionInputs: expect.objectContaining({
					providerSelectionRequest: "crm.storage.renderer",
					syntaxUnit: "syntax.unit:crm.storage.crm.storage",
					asset: "asset.asset:crm.storage.output",
					dialect: "test-storage",
				}),
			}),
		);
	}, 20000);

	test("derives target-neutral storage entities, fields, and relations", async () => {
		const result = await compileWorkspace([
			{
				id: "test-storage-render-provider",
				protocol: "openspec.provider.v1",
				document: {
					owner: "provider.provider:test-storage",
					providers: [{ id: "test-storage" }],
					offerings: [
						{
							id: "test-storage.syntax.render",
							provider: "provider.provider:test-storage",
							role: "module.render",
							dialect: "test-storage",
							adapter: "adapter.adapter:test-storage.syntax.render",
							projectionKind: "projection.syntax.render",
							params: { dialect: "test-storage" },
						},
					],
				},
			},
			{
				id: "test-storage-render-adapter",
				protocol: "openspec.adapter.v1",
				document: {
					owner: "provider.provider:test-storage",
					adapters: [
						{
							id: "test-storage.syntax.render",
							capability: "capability.capability:artifact.render",
							kind: "projection.syntax.render",
							params: { dialect: "test-storage" },
						},
					],
				},
			},
			{
				id: "canonical.entities",
				protocol: "openspec.entity.v1",
				document: {
					owner: "provider.provider:test-storage",
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
				id: "canonical.relations",
				protocol: "openspec.relation.v1",
				document: {
					owner: "provider.provider:test-storage",
					relations: [
						{
							id: "account-contact",
							name: "contacts",
							from: "account",
							to: "contact",
							cardinality: "one-to-many",
							direction: "bidirectional",
							ownership: "owned",
						},
					],
				},
			},
			{
				id: "test-storage-output",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "test.storage",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:test-storage",
								id: "test.storage",
								namespace: "test.storage",
								dialect: "test-storage",
								policy: {
									omitComputedFields: true,
								},
								artifact: {
									path: "docs/generated/test.storage",
								},
							},
						},
					],
				},
			},
		]);

		expect(result.runtime.node("storage.entity:test.storage.entity:account")).toMatchObject({
			kind: "storage.entity",
			attributes: expect.objectContaining({
				name: "Account",
				source: "entity:account",
				surface: "syntax.unit:test.storage.test.storage",
			}),
		});
		expect(result.runtime.node("storage.field:test.storage.entity:account.id")).toMatchObject({
			kind: "storage.field",
			attributes: expect.objectContaining({
				name: "id",
				nullable: false,
				identity: true,
				unique: true,
			}),
		});
		expect(result.runtime.node("storage.field:test.storage.entity:account.score")).toMatchObject({
			kind: "storage.field",
			attributes: expect.objectContaining({
				name: "score",
				nullable: true,
				type: "number",
			}),
		});
		expect(result.runtime.node("storage.field:test.storage.entity:account.rollup")).toBeUndefined();
		expect(result.runtime.node("storage.relation:test.storage.relation:account-contact")).toMatchObject({
			kind: "storage.relation",
			attributes: expect.objectContaining({
				name: "contacts",
				from: "storage.entity:test.storage.entity:account",
				to: "storage.entity:test.storage.entity:contact",
				cardinality: "one-to-many",
				direction: "bidirectional",
				ownership: "owned",
			}),
		});
		expect(result.runtime.edge("storage.relation:test.storage.relation:account-contact.from")).toMatchObject({
			kind: "storage.relation.from",
			from: "storage.relation:test.storage.relation:account-contact",
			to: "storage.entity:test.storage.entity:account",
		});
		expect(
			result.graph.facets.filter(
				(facet) =>
					facet.kind === "storage.field.nullable" &&
					facet.target === "storage.field:test.storage.entity:account.score",
			),
		).toContainEqual(expect.objectContaining({ value: true }));
	}, 20000);

	test("omits computed storage fields by default unless explicitly included", async () => {
		const result = await compileWorkspace([
			{
				id: "computed-storage-render-provider",
				protocol: "openspec.provider.v1",
				document: {
					owner: "provider.provider:test-storage-computed",
					providers: [{ id: "test-storage-computed" }],
					offerings: [
						{
							id: "test-storage-computed.syntax.render",
							provider: "provider.provider:test-storage-computed",
							role: "module.render",
							dialect: "test-storage-computed",
							adapter: "adapter.adapter:test-storage-computed.syntax.render",
							projectionKind: "projection.syntax.render",
							params: { dialect: "test-storage-computed" },
						},
					],
				},
			},
			{
				id: "computed-storage-render-adapter",
				protocol: "openspec.adapter.v1",
				document: {
					owner: "provider.provider:test-storage-computed",
					adapters: [
						{
							id: "test-storage-computed.syntax.render",
							capability: "capability.capability:artifact.render",
							kind: "projection.syntax.render",
							params: { dialect: "test-storage-computed" },
						},
					],
				},
			},
			{
				id: "computed-storage-entities",
				protocol: "openspec.entity.v1",
				document: {
					owner: "provider.provider:test-storage-computed",
					entities: [
						{
							id: "account",
							name: "Account",
							fields: [
								{ name: "id", type: "string", required: true, identity: true },
								{ name: "rollup", type: "number", required: false, computed: true },
							],
						},
					],
				},
			},
			{
				id: "computed-storage-output",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "computed.default",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:test-storage-computed",
								id: "computed.default",
								namespace: "computed.default",
								dialect: "test-storage-computed",
								artifact: { path: "docs/generated/computed.default" },
							},
						},
						{
							id: "computed.omit",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:test-storage-computed",
								id: "computed.omit",
								namespace: "computed.omit",
								dialect: "test-storage-computed",
								policy: { omitComputedFields: true },
								artifact: { path: "docs/generated/computed.omit" },
							},
						},
						{
							id: "computed.include",
							pattern: "pattern.declaration:storage.schema-output",
							inputs: {
								owner: "provider.provider:test-storage-computed",
								id: "computed.include",
								namespace: "computed.include",
								dialect: "test-storage-computed",
								policy: { omitComputedFields: false },
								artifact: { path: "docs/generated/computed.include" },
							},
						},
					],
				},
			},
		]);

		expect(result.runtime.node("storage.field:computed.default.entity:account.rollup")).toBeUndefined();
		expect(result.runtime.node("storage.field:computed.omit.entity:account.rollup")).toBeUndefined();
		expect(result.runtime.node("storage.field:computed.include.entity:account.rollup")).toMatchObject({
			kind: "storage.field",
			attributes: expect.objectContaining({
				name: "rollup",
				computed: true,
			}),
		});
	}, 20000);
});
