import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { expandPatterns } from "../src/pattern/expand.ts";

const PATTERN = "openspec.pattern.v1";
const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function loadSpecDocuments(path: string) {
	return (parse(readFileSync(`${REPO_ROOT}/${path}`, "utf8")) as { documents: unknown[] }).documents;
}

describe("load-bearing pattern expansion", () => {
	test("capability.method expands to a capability document with evaluated methods", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "cap.method.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "capability.method",
							owner: "pattern.package:capability.method",
							expands: {
								documents: [
									{
										id: {
											expr: {
												kind: "concat",
												items: [
													{ kind: "path", path: "input.id" },
													{ kind: "literal", value: ".capability" },
												],
											},
										},
										protocol: "openspec.capability.v1",
										document: {
											owner: { expr: { kind: "path", path: "input.owner" } },
											capabilities: [
												{
													id: { expr: { kind: "path", path: "input.id" } },
													kind: { expr: { kind: "path", path: "input.kind" } },
													methods: {
														expr: {
															kind: "objectFromEntries",
															path: "input.methods",
															as: "method",
															key: { kind: "path", path: "method.name" },
															value: {
																kind: "object",
																fields: {
																	output: { kind: "path", path: "method.output", optional: true },
																	description: { kind: "path", path: "method.description", optional: true },
																},
															},
														},
													},
													description: { expr: { kind: "path", path: "input.description", optional: true } },
												},
											],
										},
									},
								],
							},
						},
					],
					applications: [
						{
							id: "crm.account.cap.app",
							pattern: "pattern.declaration:capability.method",
							inputs: {
								owner: "service:crm",
								id: "crm.account",
								kind: "crm.account",
								methods: [
									{ name: "create", output: "Account" },
									{ name: "list", output: "AccountList" },
								],
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		expect(expanded).toHaveLength(1);

		expect(expanded[0]?.protocol).toBe("openspec.capability.v1");
		expect(expanded[0]?.id).toBe("crm.account.capability");

		const doc = expanded[0]?.document as Record<string, unknown>;
		expect(doc?.owner).toBe("service:crm");

		const capabilities = doc?.capabilities as Record<string, unknown>[];
		expect(capabilities).toHaveLength(1);
		expect(capabilities[0]?.id).toBe("crm.account");
		expect(capabilities[0]?.kind).toBe("crm.account");

		const methods = capabilities[0]?.methods as Record<string, unknown>;
		expect(methods?.create).toMatchObject({ output: "Account" });
		expect(methods?.list).toMatchObject({ output: "AccountList" });
	});

	test("capability.fulfillment without adapter emits facet with no adapter field (auto-resolve)", async () => {
		// When input.adapter is absent, the facet value must not carry an adapter key.
		// The fulfillment.plans selector handles the auto-resolve path when adapter is empty.
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/capability.fulfillment/spec/capability-fulfillment.pattern.openspec.yml"),
			{
				id: "cf.auto.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "schema.auto.app",
							pattern: "pattern.declaration:capability.fulfillment",
							inputs: {
								owner: "provider.provider:my-provider",
								id: "my-provider.schema",
								capability: "capability.capability:model.schema.projection",
								// adapter intentionally omitted — auto-resolve path
								projection: { kind: "model.schema.projection" },
								artifact: { path: "src/generated/schema.ts" },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		// asset + facet only (no binding document)
		expect(expanded).toHaveLength(2);

		const facetDoc = expanded.find((d) => d.protocol === "openspec.facet.v1");
		expect(facetDoc).toBeDefined();
		const doc = facetDoc?.document as Record<string, unknown>;
		const facets = doc?.facets as Record<string, unknown>[];
		expect(facets).toHaveLength(1);
		// adapter is absent — os_is_empty fires the auto-resolve path in fulfillment.plans
		expect(facets[0]?.kind).toBe("capability.fulfillment");
		expect(facets[0]?.target).toBe("capability.capability:model.schema.projection");
		const value = facets[0]?.value as Record<string, unknown>;
		expect(value?.id).toBe("my-provider.schema");
		expect(value?.projectionKind).toBe("model.schema.projection");
		// optional fields resolve to null when absent — os_is_empty(null) fires auto-resolve
		expect(value?.adapter).toBeNull();
		expect(value?.params).toBeNull();
	});

	test("provider.adapters expands to provider and adapter documents", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "my.provider.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "provider.adapters",
							owner: "pattern.package:provider.adapters",
							expands: {
								documents: [
									{
										id: {
											expr: {
												kind: "concat",
												items: [
													{ kind: "path", path: "input.provider.id" },
													{ kind: "literal", value: ".provider" },
												],
											},
										},
										protocol: "openspec.provider.v1",
										document: {
											providers: [
												{
													id: { expr: { kind: "path", path: "input.provider.id" } },
													name: { expr: { kind: "path", path: "input.provider.name", optional: true } },
													exports: {
														adapters: {
															expr: {
																kind: "map",
																path: "input.adapters",
																as: "adapter",
																value: {
																	kind: "concat",
																	items: [
																		{ kind: "literal", value: "adapter.adapter:" },
																		{ kind: "path", path: "adapter.id" },
																	],
																},
															},
														},
													},
												},
											],
										},
									},
									{
										id: {
											expr: {
												kind: "concat",
												items: [
													{ kind: "path", path: "input.provider.id" },
													{ kind: "literal", value: ".adapters" },
												],
											},
										},
										protocol: "openspec.adapter.v1",
										document: {
											owner: {
												expr: {
													kind: "concat",
													items: [
														{ kind: "literal", value: "provider.provider:" },
														{ kind: "path", path: "input.provider.id" },
													],
												},
											},
											adapters: {
												expr: {
													kind: "map",
													path: "input.adapters",
													as: "adapter",
													value: {
														kind: "object",
														fields: {
															id: { kind: "path", path: "adapter.id" },
															capability: { kind: "path", path: "adapter.capability" },
															kind: { kind: "path", path: "adapter.kind" },
														},
													},
												},
											},
										},
									},
								],
							},
						},
					],
					applications: [
						{
							id: "crm.provider.adapters.app",
							pattern: "pattern.declaration:provider.adapters",
							inputs: {
								provider: { id: "crm.provider", name: "CRM Provider" },
								adapters: [
									{
										id: "crm.account-types",
										capability: "capability.capability:model.schema.projection",
										kind: "projection",
									},
								],
							},
						},
					],
				},
			},
		]);

		expect(diagnostics).toEqual([]);
		expect(expanded).toHaveLength(2);

		const providerDoc = expanded.find((d) => d.protocol === "openspec.provider.v1");
		expect(providerDoc?.id).toBe("crm.provider.provider");
		const providerContent = providerDoc?.document as Record<string, unknown>;
		const providers = providerContent?.providers as Record<string, unknown>[];
		expect(providers[0]?.id).toBe("crm.provider");
		const exports = providers[0]?.exports as Record<string, unknown>;
		expect(exports?.adapters).toEqual(["adapter.adapter:crm.account-types"]);

		const adapterDoc = expanded.find((d) => d.protocol === "openspec.adapter.v1");
		expect(adapterDoc?.id).toBe("crm.provider.adapters");
		const adapterContent = adapterDoc?.document as Record<string, unknown>;
		const adapters = adapterContent?.adapters as Record<string, unknown>[];
		expect(adapters).toHaveLength(1);
		expect(adapters[0]?.id).toBe("crm.account-types");
		expect(adapters[0]?.capability).toBe("capability.capability:model.schema.projection");
	});

	test("model.type-output composes model syntax and syntax projection", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/model.type-output/spec/model-type-output.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/model.syntax/spec/model-syntax.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/syntax.projection/spec/syntax-projection.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/projection.asset/spec/projection-asset.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.fulfillment/spec/capability-fulfillment.pattern.openspec.yml"),
			{
				id: "crm.model.type.output.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "crm.model.types",
							pattern: "pattern.declaration:model.type-output",
							inputs: {
								owner: "service:crm",
								id: "crm.model.types",
								namespace: "crm",
								declarations: [{ name: "Account" }],
								artifact: { path: "src/types/crm.ts" },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		expect(expanded.some((doc) => doc.protocol === "openspec.syntax.v1")).toBe(true);
		expect(expanded.some((doc) => doc.protocol === "openspec.provider.v1")).toBe(true);
		expect(expanded.some((doc) => doc.protocol === "openspec.facet.v1")).toBe(true);
	});

	test("provider.co-fulfillment generates one capability.fulfillment application per fulfillment", async () => {
		// provider.co-fulfillment expands to a pattern.v1 doc whose applications
		// array is a map over input.fulfillments. Since capability.fulfillment is
		// not declared here, each fulfillment generates one unresolved diagnostic —
		// confirming the map ran and assigned correct namespaced IDs.
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "zod.provider.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "provider.co-fulfillment",
							owner: "pattern.package:capability.fulfillment",
							expands: {
								documents: [
									{
										id: {
											expr: {
												kind: "concat",
												items: [
													{ kind: "path", path: "input.id" },
													{ kind: "literal", value: ".co-fulfillment.patterns" },
												],
											},
										},
										protocol: PATTERN,
										document: {
											applications: {
												expr: {
													kind: "map",
													path: "input.fulfillments",
													as: "fulfillment",
													value: {
														kind: "object",
														fields: {
															id: {
																kind: "path",
																path: "fulfillment.id",
																optional: true,
																default: {
																	kind: "concat",
																	items: [
																		{ kind: "path", path: "input.id" },
																		{ kind: "literal", value: "." },
																		{
																			kind: "after",
																			value: { kind: "path", path: "fulfillment.capability" },
																			separator: ":",
																		},
																	],
																},
															},
															pattern: {
																kind: "literal",
																value: "pattern.declaration:capability.fulfillment",
															},
															inputs: {
																kind: "object",
																fields: {
																	owner: { kind: "path", path: "input.owner" },
																	id: {
																		kind: "path",
																		path: "fulfillment.id",
																		optional: true,
																		default: {
																			kind: "concat",
																			items: [
																				{ kind: "path", path: "input.id" },
																				{ kind: "literal", value: "." },
																				{
																					kind: "after",
																					value: { kind: "path", path: "fulfillment.capability" },
																					separator: ":",
																				},
																			],
																		},
																	},
																	capability: { kind: "path", path: "fulfillment.capability" },
																	adapter: { kind: "path", path: "fulfillment.adapter" },
																	projection: { kind: "path", path: "fulfillment.projection" },
																	artifact: { kind: "path", path: "fulfillment.artifact" },
																},
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					],
					applications: [
						{
							id: "my-provider.zod.app",
							pattern: "pattern.declaration:provider.co-fulfillment",
							inputs: {
								owner: "provider.provider:my-provider",
								id: "my-provider.zod",
								fulfillments: [
									{
										capability: "capability.capability:model.schema.projection",
										adapter: "adapter.declaration:zod.model.schema",
										projection: { kind: "model.schema.projection" },
										artifact: { path: "src/generated/schema.ts" },
									},
									{
										capability: "capability.capability:model.validation.projection",
										adapter: "adapter.declaration:zod.model.validation",
										projection: {
											kind: "model.validation.projection",
											inputs: {
												schema: {
													artifactRef: {
														projectionKind: "model.schema.projection",
														owner: "provider.provider:my-provider",
													},
												},
											},
										},
										artifact: { path: "src/generated/validation.ts" },
									},
								],
							},
						},
					],
				},
			},
		]);

		expect(expanded).toEqual([]);
		// One unresolved diagnostic per fulfillment
		expect(diagnostics).toHaveLength(2);

		const patterns = new Set(diagnostics.map((d) => d.details?.pattern as string));
		expect(patterns).toEqual(new Set(["pattern.declaration:capability.fulfillment"]));

		const ids = diagnostics
			.map((d) => d.details?.applicationId as string)
			.sort();
		expect(ids).toEqual([
			"my-provider.zod.model.schema.projection",
			"my-provider.zod.model.validation.projection",
		].sort());
	});

	test("operation.invocation-surface generates one operation.invocation application per invocation", async () => {
		// operation.invocation-surface expands to a pattern.v1 doc that maps over invocations,
		// generating one application per invocation. Since operation.invocation is
		// not declared, we get one diagnostic per invocation — confirming the map
		// expression ran and produced the correct application IDs.
		const { expanded, diagnostics } = await expandPatterns([
			{
				id: "crm.client.patterns",
				protocol: PATTERN,
				document: {
					patterns: [
						{
							id: "operation.invocation-surface",
							owner: "pattern.package:operation.invocation-surface",
							expands: {
								documents: [
									{
										id: {
											expr: {
												kind: "concat",
												items: [
													{ kind: "path", path: "input.id" },
													{ kind: "literal", value: ".invocations.pattern" },
												],
											},
										},
										protocol: PATTERN,
										document: {
											applications: {
												expr: {
													kind: "map",
													path: "input.invocations",
													as: "invocation",
													value: {
														kind: "object",
														fields: {
															id: {
																kind: "concat",
																items: [
																	{ kind: "path", path: "input.id" },
																	{ kind: "literal", value: "." },
																	{
																		kind: "after",
																		value: { kind: "path", path: "invocation.operation" },
																		separator: ":",
																	},
																	{ kind: "literal", value: ".invocation" },
																],
															},
															pattern: {
																kind: "literal",
																value: "pattern.declaration:operation.invocation",
															},
															inputs: {
																kind: "object",
																fields: {
																	owner: { kind: "path", path: "input.owner" },
																	operation: { kind: "path", path: "invocation.operation" },
																	method: { kind: "path", path: "invocation.method" },
																},
															},
														},
													},
												},
											},
										},
									},
								],
							},
						},
					],
					applications: [
						{
							id: "crm.client.app",
							pattern: "pattern.declaration:operation.invocation-surface",
							inputs: {
								owner: "service:crm",
								id: "crm.client",
								invocations: [
									{
										operation: "operation.operation:createAccount",
										method: "POST",
									},
									{
										operation: "operation.operation:listAccounts",
										method: "GET",
									},
								],
							},
						},
					],
				},
			},
		]);

		expect(expanded).toEqual([]);
		// One diagnostic per invocation — unresolved operation.invocation pattern
		expect(diagnostics).toHaveLength(2);

		const patterns = new Set(diagnostics.map((d) => d.details?.pattern as string));
		expect(patterns).toEqual(new Set(["pattern.declaration:operation.invocation"]));

		const ids = diagnostics
			.map((d) => d.details?.applicationId as string)
			.sort();
		expect(ids).toEqual(
			["crm.client.createAccount.invocation", "crm.client.listAccounts.invocation"].sort(),
		);
	});

	test("capability.contract-surface emits method contract syntax slots", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/capability.contract-surface/spec/capability-contract-surface.pattern.openspec.yml"),
			{
				id: "capability.contract.surface.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.contracts",
							pattern: "pattern.declaration:capability.contract-surface",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.contracts",
								namespace: "workspace",
								capability: "capability.capability:workspace.build",
								methods: [{ name: "run" }],
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const syntaxDoc = expanded[0]?.document as {
			slots: Array<{ id: string; role: string; target: string }>;
		};
		expect(syntaxDoc.slots[0]).toMatchObject({
			id: "run.contract",
			role: "method.contract",
			target: "capability.capability:workspace.build.run",
		});
	});

	test("capability.adapter-contract-surface emits public adapter contract syntax slots", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments(
				"patterns/capability.adapter-contract-surface/spec/capability-adapter-contract-surface.pattern.openspec.yml",
			),
			{
				id: "capability.adapter.contract.surface.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "storage.writer.adapter.contract",
							pattern: "pattern.declaration:capability.adapter-contract-surface",
							inputs: {
								owner: "capability.package:storage.writer",
								id: "storage.writer.adapter-contract",
								namespace: "storage.writer.adapter-contract",
								capability: "capability.capability:storage.writer",
								methods: [{ name: "write" }],
								metadata: { adapterTypeName: "StorageWriterAdapter" },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const syntaxDoc = expanded[0]?.document as {
			units: Array<{ role: string; subject: string; metadata: unknown }>;
			slots: Array<{ id: string; role: string; target: string }>;
		};
		expect(syntaxDoc.units[0]).toMatchObject({
			role: "capability.adapter-contract.surface",
			subject: "capability.capability:storage.writer",
			metadata: { adapterTypeName: "StorageWriterAdapter" },
		});
		expect(syntaxDoc.slots[0]).toMatchObject({
			id: "write.adapter-contract",
			role: "adapter.contract.method",
			target: "capability.capability:storage.writer.write",
		});
	});

	test("capability.package-output composes model types, adapter contract surface, and syntax projection", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/model.syntax/spec/model-syntax.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/model.type-output/spec/model-type-output.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.contract-surface/spec/capability-contract-surface.pattern.openspec.yml"),
			...loadSpecDocuments(
				"patterns/capability.adapter-contract-surface/spec/capability-adapter-contract-surface.pattern.openspec.yml",
			),
			...loadSpecDocuments("patterns/projection.asset/spec/projection-asset.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.fulfillment/spec/capability-fulfillment.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/syntax.projection/spec/syntax-projection.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.package-output/spec/capability-package-output.pattern.openspec.yml"),
			{
				id: "capability.package.output.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "storage.writer",
							pattern: "pattern.declaration:capability.package-output",
							inputs: {
								owner: "capability.package:storage.writer",
								id: "storage.writer",
								namespace: "storage.writer",
								capability: "capability.capability:storage.writer",
								models: [{ name: "WriteBatch" }, { name: "WriteReport" }],
								methods: [{ name: "write" }],
								artifacts: {
									types: { path: "capabilities/storage.writer/src/sdk/storage-writer-types.generated.ts" },
									adapter: { path: "capabilities/storage.writer/src/sdk/storage-writer.generated.ts" },
								},
								adapterContract: {
									modelImportPath: "./storage-writer-types.generated",
									adapterTypeName: "StorageWriterAdapter",
									contractTypeName: "StorageWriterAdapterContract",
									contractConstName: "storageWriterAdapterContract",
									implementFunctionName: "implementStorageWriterAdapter",
									aliasName: "StorageWriter",
								},
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		expect(expanded.map((doc) => doc.protocol).sort()).toContain("openspec.syntax.v1");
		const syntaxDocs = expanded.filter((doc) => doc.protocol === "openspec.syntax.v1");
		expect(
			syntaxDocs.some((doc) =>
				((doc.document as { units?: Array<{ role: string }> }).units ?? []).some(
					(unit) => unit.role === "capability.adapter-contract.surface",
				),
			),
		).toBe(true);
		const projectionFacets = expanded.filter((doc) => doc.protocol === "openspec.facet.v1");
		expect(
			projectionFacets.some((doc) =>
				((doc.document as { facets?: Array<{ value: { projectionKind?: string } }> }).facets ?? []).some(
					(facet) => facet.value.projectionKind === "projection.syntax.render",
				),
			),
		).toBe(true);
	});

	test("adapter.implementation-surface emits implementation handler syntax slots", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/adapter.implementation-surface/spec/adapter-implementation-surface.pattern.openspec.yml"),
			{
				id: "adapter.implementation.surface.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.implementation",
							pattern: "pattern.declaration:adapter.implementation-surface",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.implementation",
								namespace: "workspace",
								adapter: "adapter.adapter:workspace.build.default",
								capability: "capability.capability:workspace.build",
								methods: [{ name: "run" }],
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const syntaxDoc = expanded[0]?.document as {
			slots: Array<{ id: string; role: string; target: string }>;
		};
		expect(syntaxDoc.slots[0]).toMatchObject({
			id: "run.implementation",
			role: "implementation.handler",
			target: "adapter.adapter:workspace.build.default.run",
		});
	});

	test("adapter.asset composes an adapter implementation asset with a structural binding", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/adapter.asset/spec/adapter-asset.pattern.openspec.yml"),
			{
				id: "workspace.adapter.asset.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.implementation",
							pattern: "pattern.declaration:adapter.asset",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.implementation",
								adapter: "adapter.adapter:workspace.build.default",
								asset: {
									path: "engines/workspace/src/index.ts",
									language: "typescript",
								},
								dispatch: "workspace.build.default.run",
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		expect(expanded.map((doc) => doc.protocol).sort()).toEqual([
			"openspec.asset.v1",
			"openspec.binding.v1",
		]);

		const assetDoc = expanded.find((doc) => doc.protocol === "openspec.asset.v1")?.document as {
			assets: Array<{ id: string; subjects: string[] }>;
		};
		expect(assetDoc.assets[0]).toMatchObject({
			id: "implementation",
			subjects: ["adapter.adapter:workspace.build.default"],
		});

		const bindingDoc = expanded.find((doc) => doc.protocol === "openspec.binding.v1")?.document as {
			bindings: Array<{ kind: string; subject: string; slot: string; value: { dispatch: string } }>;
		};
		expect(bindingDoc.bindings[0]).toMatchObject({
			kind: "adapter.implementation.asset",
			subject: "asset.asset:workspace.build.implementation.implementation",
			slot: "adapter.adapter:workspace.build.default",
			value: { dispatch: "workspace.build.default.run" },
		});
	});

	test("operation.fulfillment emits an operation-to-target binding", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/operation.fulfillment/spec/operation-fulfillment.pattern.openspec.yml"),
			{
				id: "operation.fulfillment.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.fulfillment.app",
							pattern: "pattern.declaration:operation.fulfillment",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.fulfillment",
								operation: "operation.operation:workspace.build",
								target: "capability.method:workspace.build.run",
								inputMapping: { root: { var: "input.root" } },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const bindingDoc = expanded[0]?.document as {
			bindings: Array<{ kind: string; subject: string; slot: string; value: unknown }>;
		};
		expect(bindingDoc.bindings[0]).toMatchObject({
			kind: "operation.fulfillment",
			subject: "operation.operation:workspace.build",
			slot: "capability.method:workspace.build.run",
			value: { inputMapping: { root: { var: "input.root" } } },
		});
	});

	test("operation.entrypoint emits an entrypoint handled by an operation", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/operation.entrypoint/spec/operation-entrypoint.pattern.openspec.yml"),
			{
				id: "operation.entrypoint.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.entrypoint.app",
							pattern: "pattern.declaration:operation.entrypoint",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.cli",
								operation: "operation.operation:workspace.build",
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const entrypointDoc = expanded[0]?.document as {
			entrypoints: Array<{ id: string; handler: string; kind: string }>;
		};
		expect(entrypointDoc.entrypoints[0]).toMatchObject({
			id: "workspace.build.cli",
			handler: "operation.operation:workspace.build",
			kind: "operation.entrypoint",
		});
	});

	test("entrypoint.transport emits an entrypoint-to-transport binding", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/entrypoint.transport/spec/entrypoint-transport.pattern.openspec.yml"),
			{
				id: "entrypoint.transport.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.stdio.app",
							pattern: "pattern.declaration:entrypoint.transport",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.stdio",
								entrypoint: "entrypoint.entrypoint:workspace.build.cli",
								transport: "transport.transport:workspace.stdio",
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const bindingDoc = expanded[0]?.document as {
			bindings: Array<{ kind: string; subject: string; slot: string }>;
		};
		expect(bindingDoc.bindings[0]).toMatchObject({
			kind: "entrypoint.transport",
			subject: "entrypoint.entrypoint:workspace.build.cli",
			slot: "transport.transport:workspace.stdio",
		});
	});

	test("entrypoint.surface emits a facet targeting the entrypoint", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/entrypoint.surface/spec/entrypoint-surface.pattern.openspec.yml"),
			{
				id: "entrypoint.surface.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.cli.app",
							pattern: "pattern.declaration:entrypoint.surface",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.cli",
								kind: "cli.command",
								entrypoint: "entrypoint.entrypoint:workspace.build.cli",
								value: { command: "build" },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const facetDoc = expanded[0]?.document as {
			facets: Array<{ id: string; kind: string; target: string; value: unknown }>;
		};
		expect(facetDoc.facets[0]).toMatchObject({
			id: "workspace.build.cli",
			kind: "cli.command",
			target: "entrypoint.entrypoint:workspace.build.cli",
			value: { command: "build" },
		});
	});

	test("cli.transport.command composes operation entrypoint, transport binding, and command surface", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/cli.transport.command/spec/cli-transport-command.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/operation.entrypoint/spec/operation-entrypoint.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/entrypoint.transport/spec/entrypoint-transport.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/entrypoint.surface/spec/entrypoint-surface.pattern.openspec.yml"),
			{
				id: "cli.transport.command.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.build.cli.app",
							pattern: "pattern.declaration:cli.transport.command",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.build.cli",
								operation: "operation.operation:workspace.build",
								transport: "transport.transport:workspace.stdio",
								command: "build",
								description: "Build the workspace",
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const entrypointDoc = expanded.find(
			(doc) => doc.protocol === "openspec.entrypoint.v1",
		)?.document as { entrypoints: Array<{ id: string; handler: string }> };
		const bindingDoc = expanded.find(
			(doc) => doc.protocol === "openspec.binding.v1",
		)?.document as {
			bindings: Array<{ id: string; kind: string; subject: string; slot: string }>;
		};
		const facetDoc = expanded.find(
			(doc) => doc.protocol === "openspec.facet.v1",
		)?.document as {
			facets: Array<{ id: string; kind: string; target: string; value: unknown }>;
		};

		expect(entrypointDoc.entrypoints[0]).toMatchObject({
			id: "workspace.build.cli",
			handler: "operation.operation:workspace.build",
		});
		expect(bindingDoc.bindings[0]).toMatchObject({
			id: "workspace.build.cli.transport",
			kind: "entrypoint.transport",
			subject: "entrypoint.entrypoint:workspace.build.cli",
			slot: "transport.transport:workspace.stdio",
		});
		expect(facetDoc.facets[0]).toMatchObject({
			id: "workspace.build.cli",
			kind: "cli.command",
			target: "entrypoint.entrypoint:workspace.build.cli",
			value: { command: "build", description: "Build the workspace" },
		});
	});

	test("projection.asset delegates to the fulfillment request primitive", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/projection.asset/spec/projection-asset.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.fulfillment/spec/capability-fulfillment.pattern.openspec.yml"),
			{
				id: "projection.asset.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.cli.commands.app",
							pattern: "pattern.declaration:projection.asset",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.cli.commands",
								artifact: { path: "engines/workspace/src/generated/syntax-surface.generated.ts" },
								projection: {
									kind: "projection.syntax.render",
									inputs: { syntaxUnit: "syntax.unit:workspace.cli.program.module" },
								},
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		expect(expanded.map((doc) => doc.protocol).sort()).toEqual([
			"openspec.asset.v1",
			"openspec.facet.v1",
		]);
		const facetDoc = expanded.find((doc) => doc.protocol === "openspec.facet.v1")?.document as {
			facets: Array<{ target: string; value: { projectionKind: string } }>;
		};
		expect(facetDoc.facets[0]).toMatchObject({
			target: "capability.capability:model.schema.projection",
			value: { projectionKind: "projection.syntax.render" },
		});
	});

	test("host.runtime emits a host environment", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/host.runtime/spec/host-runtime.pattern.openspec.yml"),
			{
				id: "host.runtime.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "workspace.cli.host.app",
							pattern: "pattern.declaration:host.runtime",
							inputs: {
								owner: "provider.provider:workspace",
								id: "workspace.cli",
								name: "Workspace CLI host",
								dispatches: [
									{
										adapter: "adapter.adapter:workspace.build.default",
										method: "capability.method:workspace.build.run",
										dispatch: "workspace.build.default.run",
									},
								],
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const hostDoc = expanded[0]?.document as {
			environments: Array<{ id: string; dispatches: Array<{ dispatch: string }> }>;
		};
		expect(hostDoc.environments[0]).toMatchObject({
			id: "workspace.cli",
			dispatches: [{ dispatch: "workspace.build.default.run" }],
		});
	});

	test("model.syntax emits target-neutral syntax for model declarations", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/model.syntax/spec/model-syntax.pattern.openspec.yml"),
			{
				id: "model.syntax.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "crm.schemas.syntax.app",
							pattern: "pattern.declaration:model.syntax",
							inputs: {
								owner: "domain:crm",
								id: "schemas",
								namespace: "crm",
								declarations: [{ name: "Account" }],
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const syntaxDoc = expanded[0]?.document as {
			units: Array<{ id: string; kind: string }>;
			symbols: Array<{ id: string; target: string }>;
			slots: Array<{ id: string; target: string; role: string }>;
		};
		expect(syntaxDoc.units[0]).toMatchObject({ id: "schemas", kind: "model.type.surface" });
		expect(syntaxDoc.symbols[0]).toMatchObject({
			id: "Account",
			target: "model:domain:crm.Account",
		});
		expect(syntaxDoc.slots[0]).toMatchObject({
			id: "Account.value",
			target: "model:domain:crm.Account",
			role: "type.declaration",
		});
	});

	test("syntax.asset emits an asset whose subject is the syntax unit", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/syntax.asset/spec/syntax-asset.pattern.openspec.yml"),
			{
				id: "syntax.asset.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "crm.schemas.asset.app",
							pattern: "pattern.declaration:syntax.asset",
							inputs: {
								owner: "domain:crm",
								id: "schemas",
								namespace: "crm",
								syntaxUnit: "syntax.unit:crm.schemas",
								asset: {
									path: "src/generated/crm.schemas.ts",
									language: "typescript",
									mediaType: "text/x.typescript",
								},
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const assetDoc = expanded[0]?.document as {
			assets: Array<{ subjects: string[]; locator: { path: string } }>;
		};
		expect(assetDoc.assets[0]).toMatchObject({
			subjects: ["syntax.unit:crm.schemas"],
			locator: { path: "src/generated/crm.schemas.ts" },
		});
	});

	test("syntax.projection delegates to projection.asset and emits a renderer selection request", async () => {
		const { expanded, diagnostics } = await expandPatterns([
			...loadSpecDocuments("patterns/syntax.projection/spec/syntax-projection.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/projection.asset/spec/projection-asset.pattern.openspec.yml"),
			...loadSpecDocuments("patterns/capability.fulfillment/spec/capability-fulfillment.pattern.openspec.yml"),
			{
				id: "syntax.projection.app",
				protocol: PATTERN,
				document: {
					applications: [
						{
							id: "crm.schemas.render.app",
							pattern: "pattern.declaration:syntax.projection",
							inputs: {
								owner: "domain:crm",
								id: "crm.schemas.render",
								syntaxUnit: "syntax.unit:crm.schemas",
								artifact: { path: "src/generated/crm.schemas.ts" },
								params: { format: "typescript" },
							},
						},
					],
				},
			},
		] as never[]);

		expect(diagnostics).toEqual([]);
		const providerDoc = expanded.find((doc) => doc.protocol === "openspec.provider.v1")?.document as {
			selectionRequests: Array<{ target: string; role: string; params?: Record<string, unknown> }>;
		};
		expect(providerDoc.selectionRequests[0]).toMatchObject({
			target: "syntax.unit:crm.schemas",
			role: "module.render",
			params: { format: "typescript" },
		});

		const facetDoc = expanded.find((doc) => doc.protocol === "openspec.facet.v1")?.document as {
			facets: Array<{ target: string; value: { projectionKind: string; inputs: { providerSelectionRequest: string; syntaxUnit: string; asset: string }; params: { format: string } } }>;
		};
		expect(facetDoc.facets[0]).toMatchObject({
			target: "capability.capability:artifact.render",
			value: {
				projectionKind: "projection.syntax.render",
				inputs: {
					providerSelectionRequest: "crm.schemas.render.renderer",
					syntaxUnit: "syntax.unit:crm.schemas",
					asset: "asset.asset:crm.schemas.render.output",
				},
				params: { format: "typescript" },
			},
		});
	});
});
