import { describe, expect, test } from "bun:test";
import { semanticFactKind, semanticNodeId } from "@openspec/kernel";
import {
	collectProtocolPackages,
	createCompiler,
	defineDerivationPass,
	defineProtocol,
	defineProtocolPackage,
	describeCollectedProtocolPackages,
	describeCompileRun,
	describeDefineProtocolPackageInput,
	describeProtocol,
	describeProtocolPackage,
	type SemanticContribution,
} from "../src/index.ts";
import {
	expectDiagnosticCodes,
	expectNoDiagnostics,
	toyNodeId,
	toyNodeIds,
	toyProtocol,
	toyProtocolPackage,
} from "../src/testing/index.ts";

describe("@openspec/compiler seed", () => {
	test("lowers object documents into one graph", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					id: "doc.accounts",
					protocol: "toy.v1",
					source: {
						path: "accounts.yml",
					},
					document: {
						nodes: [
							{
								id: "account",
								label: "Account",
							},
							{
								id: "invoice",
								label: "Invoice",
							},
						],
						edges: [
							{
								id: "account.invoice",
								from: "account",
								to: "invoice",
							},
						],
						facets: [
							{
								id: "account.documentation",
								target: "account",
								value: "Customer account.",
							},
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.graph.nodes.map((node) => String(node.id))).toEqual([
			toyNodeId("account"),
			toyNodeId("invoice"),
		]);
		expect(
			result.runtime
				.neighbors(toyNodeId("account"))
				.map((node) => String(node.id)),
		).toEqual([toyNodeId("invoice")]);
		expect(
			result.runtime
				.neighbors(toyNodeId("account"), { kind: "toy.edge" })
				.map((node) => String(node.id)),
		).toEqual([toyNodeId("invoice")]);
		expect(
			result.runtime
				.neighbors(toyNodeId("account"), { kind: "missing.edge" })
				.map((node) => String(node.id)),
		).toEqual([]);
		expect(result.runtime.facet("account.documentation")?.value).toBe(
			"Customer account.",
		);
		expect(result.runtime.node(toyNodeId("account"))?.provenance).toEqual([
			{
				protocol: "toy.v1",
				documentId: "doc.accounts",
				contribution: 0,
				source: {
					path: "accounts.yml",
				},
			},
		]);
	});

	test("reports unknown document protocols", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "missing.v1",
					document: {},
				},
			],
		});

		expectDiagnosticCodes(result, ["protocol.unknown"]);
		expect(result.graph.nodes).toEqual([]);
	});

	test("reports duplicate registered protocols", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [],
		});

		expectDiagnosticCodes(result, ["protocol.duplicate"]);
	});

	test("composes facts from multiple protocols", async () => {
		const other = toyProtocol("other.v1");
		const compiler = createCompiler({
			protocols: [toyProtocol(), other],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "left" }],
					},
				},
				{
					protocol: "other.v1",
					document: {
						nodes: [{ id: "right", kind: "other.node" }],
						edges: [{ id: "left.right", from: "left", to: "right" }],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.graph.nodes.map((node) => String(node.id))).toEqual([
			toyNodeId("left"),
			toyNodeId("right"),
		]);
		expect(result.runtime.edge("left.right")).toMatchObject({
			from: toyNodeId("left"),
			to: toyNodeId("right"),
		});
	});

	test("dedupes identical facts and preserves provenance", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					id: "a",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "shared" }],
					},
				},
				{
					id: "b",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "shared" }],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.graph.nodes).toHaveLength(1);
		expect(result.runtime.node(toyNodeId("shared"))?.provenance).toHaveLength(2);
	});

	test("diagnoses conflicting duplicate facts without overwriting the first", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "shared", label: "First" }],
					},
				},
				{
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "shared", label: "Second" }],
					},
				},
			],
		});

		expectDiagnosticCodes(result, ["graph.node.conflict"]);
		expect(result.runtime.node(toyNodeId("shared"))?.attributes).toEqual({
			label: "First",
		});
	});

	test("diagnoses missing edge endpoints and facet targets", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "known" }],
						edges: [{ id: "broken", from: "known", to: "missing" }],
						facets: [{ id: "ghost.note", target: "ghost", value: "nope" }],
					},
				},
			],
		});

		expectDiagnosticCodes(result, [
			"graph.edge.missingTo",
			"graph.facet.missingTarget",
		]);
	});

	test("runs protocol validation over the composed graph", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						requireNode: "missing",
					},
				},
			],
		});

		expectDiagnosticCodes(result, ["toy.requiredNodeMissing"]);
	});

	test("runs selectors through the runtime", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						nodes: [
							{ id: "a", kind: "selected" },
							{ id: "b", kind: "ignored" },
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(
			result.runtime.select<string[]>("nodeIds", { kind: "selected" }),
		).toEqual([toyNodeId("a")]);
	});

	test("keeps graph output deterministic", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "z" }, { id: "a" }],
						edges: [
							{ id: "z.a", from: "z", to: "a" },
							{ id: "a.z", from: "a", to: "z" },
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.graph.nodes.map((node) => String(node.id))).toEqual([
			toyNodeId("a"),
			toyNodeId("z"),
		]);
		expect(result.graph.edges.map((edge) => String(edge.id))).toEqual([
			"a.z",
			"z.a",
		]);
	});

	test("allows fresh protocols without changing compiler modules", async () => {
		const compiler = createCompiler({
			protocols: [
				defineProtocol<{ id: string }>({
					id: "fresh.v1",
					lower(document, context): SemanticContribution {
						return {
							protocol: context.document.protocol,
							documentId: context.document.id,
							nodes: [
								{
									id: semanticNodeId("fresh.thing", document.id),
									kind: semanticFactKind("fresh.thing"),
								},
							],
						};
					},
				}),
			],
		});

		const result = await compiler.compile({
			documents: [
				{
					protocol: "fresh.v1",
					document: {
						id: "external-semantic-thing",
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(
			result.runtime
				.nodes({ kind: "fresh.thing" })
				.map((node) => String(node.id)),
		).toEqual([semanticNodeId("fresh.thing", "external-semantic-thing")]);
	});

	test("accepts protocol packages as the ergonomic registration unit", async () => {
		const compiler = createCompiler({
			packages: [toyProtocolPackage()],
		});

		const result = await compiler.compile({
			documents: [
				{
					id: "consumer.doc",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "consumer.node" }],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.graph.nodes.map((node) => String(node.id))).toEqual([
			toyNodeId("consumer.node"),
			toyNodeId("toy.SemanticNode"),
		]);
		expect(
			result.runtime.node(toyNodeId("toy.SemanticNode"))?.provenance,
		).toEqual([
			{
				protocol: "toy.v1",
				documentId: "toy.package.model",
				contribution: 0,
				source: {
					path: "toy.package.yml",
				},
			},
		]);
	});

	test("composes package contributions before documents", async () => {
		const compiler = createCompiler({
			packages: [
				defineProtocolPackage({
					id: "meta.package",
					contribution: {
						protocol: "openspec.meta",
						documentId: "meta.package",
						nodes: [
							{
								id: semanticNodeId("package.meta", "seed"),
								kind: semanticFactKind("package.meta"),
								attributes: { id: "seed" },
							},
						],
					},
				}),
			],
		});

		const result = await compiler.compile({ documents: [] });

		expectNoDiagnostics(result);
		expect(result.runtime.node("package.meta:seed")).toEqual({
			id: semanticNodeId("package.meta", "seed"),
			kind: semanticFactKind("package.meta"),
			attributes: { id: "seed" },
			provenance: [
				{
					protocol: "openspec.meta",
					documentId: "meta.package",
					contribution: 0,
				},
			],
		});
	});

	test("runs passes against package contribution facts", async () => {
		const compiler = createCompiler({
			packages: [
				defineProtocolPackage({
					id: "meta.package",
					contribution: {
						protocol: "openspec.meta",
						documentId: "meta.package",
						nodes: [
							{
								id: semanticNodeId("package.meta", "seed"),
								kind: semanticFactKind("package.meta"),
							},
						],
					},
					passes: [
						defineDerivationPass({
							id: "package.meta.pass",
							reads: ["package.meta"],
				writes: ["package.meta.seen"],
				derive({ runtime }) {
					return runtime.node("package.meta:seed")
									? {
											nodes: [
												{
													id: semanticNodeId("package.meta.seen", "seed"),
													kind: semanticFactKind("package.meta.seen"),
												},
											],
										}
									: {};
							},
						}),
					],
				}),
			],
		});

		const result = await compiler.compile({ documents: [] });

		expectNoDiagnostics(result);
		expect(result.runtime.node("package.meta.seen:seed")).toMatchObject({
			id: semanticNodeId("package.meta.seen", "seed"),
			kind: semanticFactKind("package.meta.seen"),
		});
	});

	test("describes protocol package extension boundaries as serializable data", () => {
		const protocol = toyProtocol();
		const protocolPackage = toyProtocolPackage();
		const directPackageInput = {
			id: "direct.package",
			version: "2.0.0",
			protocols: [protocol],
			documents: [],
			metadata: { role: "test" },
		};

		expect(describeProtocol(protocol)).toEqual({
			id: "toy.v1",
			stages: ["parse", "lower", "validate"],
			selectorIds: ["nodeIds"],
		});
		expect(describeProtocolPackage(protocolPackage)).toEqual({
			id: "toy.package",
			version: "1.0.0",
			protocols: [
				{
					id: "toy.v1",
					package: { id: "toy.package", version: "1.0.0" },
					stages: ["parse", "lower", "validate"],
					selectorIds: ["nodeIds"],
				},
			],
			documents: [
				{
					id: "toy.package.model",
					protocol: "toy.v1",
					source: { path: "toy.package.yml" },
					document: {
						nodes: [
							{
								id: "toy.SemanticNode",
								kind: "toy.model",
								label: "SemanticNode",
							},
						],
					},
				},
			],
		});
		expect(describeDefineProtocolPackageInput(directPackageInput)).toEqual({
			id: "direct.package",
			version: "2.0.0",
			protocols: [
				{
					id: "toy.v1",
					package: { id: "direct.package", version: "2.0.0" },
					stages: ["parse", "lower", "validate"],
					selectorIds: ["nodeIds"],
				},
			],
			documents: [],
			metadata: { role: "test" },
		});

		const collected = collectProtocolPackages({
			protocols: [protocol],
			packages: [defineProtocolPackage(directPackageInput)],
		});
		expect(describeCollectedProtocolPackages(collected)).toEqual({
			protocols: [
				{
					id: "toy.v1",
					stages: ["parse", "lower", "validate"],
					selectorIds: ["nodeIds"],
				},
				{
					id: "toy.v1",
					package: { id: "direct.package", version: "2.0.0" },
					stages: ["parse", "lower", "validate"],
					selectorIds: ["nodeIds"],
				},
			],
			documents: [],
		});
	});

	test("describes compile runs as serializable evidence", async () => {
		const protocolPackage = toyProtocolPackage();
		const compilerInput = {
			protocols: [toyProtocol("direct.v1")],
			packages: [protocolPackage],
		};
		const compiler = createCompiler(compilerInput);
		const compileInput = {
			documents: [
				{
					id: "consumer.doc",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "consumer.node" }],
					},
				},
			],
		};

		const result = await compiler.compile(compileInput);
		const run = describeCompileRun({
			input: compileInput,
			result,
			...compilerInput,
		});

		expect(run.input.documents).toEqual(compileInput.documents);
		expect(run.input.protocols).toEqual([
			{
				id: "direct.v1",
				stages: ["parse", "lower", "validate"],
				selectorIds: ["nodeIds"],
			},
		]);
		expect(run.input.protocolPackages).toEqual([
			{
				id: "toy.package",
				version: "1.0.0",
				protocols: [
					{
						id: "toy.v1",
						package: { id: "toy.package", version: "1.0.0" },
						stages: ["parse", "lower", "validate"],
						selectorIds: ["nodeIds"],
					},
				],
				documents: [
					{
						id: "toy.package.model",
						protocol: "toy.v1",
						source: { path: "toy.package.yml" },
						document: {
							nodes: [
								{
									id: "toy.SemanticNode",
									kind: "toy.model",
									label: "SemanticNode",
								},
							],
						},
					},
				],
			},
		]);
		expect(run.output.graph.nodes.map((node) => String(node.id))).toEqual([
			toyNodeId("consumer.node"),
			toyNodeId("toy.SemanticNode"),
		]);
		expect(run.output.diagnostics).toEqual([]);
		expect(run.output.trace.map((event) => event.stage)).toEqual([
			"document.normalize",
			"protocol.parse",
			"protocol.lower",
			"protocol.parse",
			"protocol.lower",
			"protocol.validate",
			"protocol.validate",
		]);
	});
});
