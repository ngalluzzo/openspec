import { describe, expect, test } from "bun:test";
import { semanticFactKind } from "@openspec/kernel";
import {
	createCompiler,
	defineProtocol,
	type SemanticContribution,
} from "../src/index.ts";
import {
	expectDiagnosticCodes,
	expectNoDiagnostics,
	toyProtocol,
} from "../src/testing/index.ts";

describe("openspec.derivation.v1", () => {
	test("lowers derivation documents into graph.derive.rule facts", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "prepare",
								source: {
									selector: "missing.selector",
									as: "item",
									optional: true,
								},
								facts: [],
							},
							{
								id: "make.summary",
								source: {
									selector: "missing.selector",
									as: "item",
									optional: true,
								},
								after: ["prepare"],
								description: "Summarize cross-protocol facts.",
								facts: [],
							},
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(
			result.runtime.node(
				"graph.derive.rule:openspec.derivation.v1.make.summary",
			),
		).toMatchObject({
			kind: "graph.derive.rule",
			attributes: {
				id: "make.summary",
				owner: "protocol.protocol:openspec.derivation.v1",
				subject: "openspec.derivation.v1",
				selector: "missing.selector",
				as: "item",
				optional: true,
				after: ["prepare"],
				facts: [],
				description: "Summarize cross-protocol facts.",
			},
		});
		expect(
			result.runtime.edge(
				"protocol.protocol:openspec.derivation.v1.derivation.rule.make.summary",
			),
		).toMatchObject({
			kind: "derivation.owner.rule",
			from: "protocol.protocol:openspec.derivation.v1",
			to: "graph.derive.rule:openspec.derivation.v1.make.summary",
		});
	});

	test("derives facts across protocol selectors", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "toy.source",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "account" }],
					},
				},
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "summarize.toy",
								source: { selector: "toyNodeIds", as: "nodeId" },
								facts: [
									{
										kind: "node",
										id: {
											kind: "concat",
											items: [
												"derived.summary:",
												{
													kind: "after",
													value: { kind: "path", path: "nodeId" },
													separator: ":",
												},
											],
										},
										factKind: "derived.summary",
										attributes: {
											kind: "object",
											fields: {
												source: { kind: "path", path: "nodeId" },
											},
										},
									},
								],
							},
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.runtime.node("derived.summary:account")).toMatchObject({
			kind: "derived.summary",
			attributes: {
				source: "toy.node:account",
			},
			provenance: expect.arrayContaining([
				expect.objectContaining({
					protocol: "openspec.derivation.v1",
					documentId: "derived.rules",
				}),
			]),
		});
	});

	test("derived facts carry provenance from selected input facts", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "toy.source",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "account" }],
					},
				},
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "copy.toy",
								source: { selector: "toyNodes", as: "node" },
								facts: [
									{
										kind: "node",
										id: "derived.copy:account",
										factKind: "derived.copy",
									},
								],
							},
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.runtime.node("derived.copy:account")?.provenance).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					protocol: "openspec.derivation.v1",
					documentId: "derived.rules",
				}),
				expect.objectContaining({
					protocol: "toy.v1",
					documentId: "toy.source",
				}),
			]),
		);
	});

	test("runs derivation rules in after dependency phases", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "toy.source",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "account" }],
					},
				},
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "seed",
								source: { selector: "toyNodeIds", as: "nodeId" },
								facts: [
									{
										kind: "node",
										id: "derived.seed:account",
										factKind: "derived.seed",
									},
								],
							},
							{
								id: "consume",
								source: { selector: "derivedSeeds", as: "seed" },
								after: ["seed"],
								facts: [
									{
										kind: "node",
										id: "derived.final:account",
										factKind: "derived.final",
										attributes: {
											kind: "object",
											fields: {
												seed: { kind: "path", path: "seed.id" },
											},
										},
									},
								],
							},
						],
					},
				},
			],
		});

		expectNoDiagnostics(result);
		expect(result.runtime.node("derived.final:account")).toMatchObject({
			kind: "derived.final",
			attributes: {
				seed: "derived.seed:account",
			},
		});
	});

	test("diagnoses missing selectors, unknown dependencies, and cycles", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "missing.selector",
								source: { selector: "doesNotExist", as: "item" },
								facts: [],
							},
							{
								id: "missing.dependency",
								source: { selector: "toyNodeIds", as: "item" },
								after: ["does.not.exist"],
								facts: [],
							},
							{
								id: "cycle.a",
								source: { selector: "toyNodeIds", as: "item" },
								after: ["cycle.b"],
								facts: [],
							},
							{
								id: "cycle.b",
								source: { selector: "toyNodeIds", as: "item" },
								after: ["cycle.a"],
								facts: [],
							},
						],
					},
				},
			],
		});

		expectDiagnosticCodes(result, [
			"derivation.rule.after.cycle",
			"derivation.rule.after.unknown",
			"derivation.rule.selector.missing",
		]);
	});

	test("composes derived facts through graph conflict diagnostics", async () => {
		const compiler = createCompiler({
			protocols: [toyProtocol(), helperSelectorsProtocol()],
		});

		const result = await compiler.compile({
			documents: [
				...derivationProtocolDocuments(),
				{
					id: "toy.source",
					protocol: "toy.v1",
					document: {
						nodes: [{ id: "account", label: "Original" }],
					},
				},
				{
					id: "derived.rules",
					protocol: "openspec.derivation.v1",
					document: {
						owner: "protocol.protocol:openspec.derivation.v1",
						rules: [
							{
								id: "conflict",
								source: { selector: "toyNodeIds", as: "nodeId" },
								facts: [
									{
										kind: "node",
										id: { kind: "path", path: "nodeId" },
										factKind: "toy.node",
										attributes: {
											kind: "object",
											fields: {
												label: "Derived",
											},
										},
									},
								],
							},
						],
					},
				},
			],
		});

		expectDiagnosticCodes(result, ["graph.node.conflict"]);
		expect(result.runtime.node("toy.node:account")?.attributes).toEqual({
			label: "Original",
		});
	});
});

function derivationProtocolDocuments() {
	return [
		{
			id: "derivation.protocol",
			protocol: "openspec.protocol.v1",
			document: {
				id: "openspec.derivation.v1",
			},
		},
		{
			id: "derivation.graph",
			protocol: "openspec.graph.v1",
			document: {
				subject: "openspec.derivation.v1",
				owner: "protocol.protocol:openspec.derivation.v1",
				lowering: [
					{
						id: "derivation.rules",
						source: {
							path: "rules",
							as: "rule",
						},
						facts: [
							{
								kind: "node",
								id: {
									kind: "concat",
									items: [
										"graph.derive.rule:openspec.derivation.v1.",
										{ kind: "path", path: "rule.id" },
									],
								},
								factKind: "graph.derive.rule",
								attributes: {
									kind: "object",
									fields: {
										id: { kind: "path", path: "rule.id" },
										owner: { kind: "path", path: "document.owner" },
										subject: "openspec.derivation.v1",
										selector: { kind: "path", path: "rule.source.selector" },
										as: { kind: "path", path: "rule.source.as" },
										optional: {
											kind: "path",
											path: "rule.source.optional",
											optional: true,
										},
										after: {
											kind: "path",
											path: "rule.after",
											optional: true,
										},
										facts: { kind: "path", path: "rule.facts" },
										description: {
											kind: "path",
											path: "rule.description",
											optional: true,
										},
									},
								},
							},
							{
								kind: "edge",
								id: {
									kind: "concat",
									items: [
										{ kind: "path", path: "document.owner" },
										".derivation.rule.",
										{ kind: "path", path: "rule.id" },
									],
								},
								factKind: "derivation.owner.rule",
								from: { kind: "path", path: "document.owner" },
								to: {
									kind: "concat",
									items: [
										"graph.derive.rule:openspec.derivation.v1.",
										{ kind: "path", path: "rule.id" },
									],
								},
							},
						],
					},
				],
				selectors: [
					{
						id: "derivation.rules",
						sources: {
							rule: {
								kind: "nodes",
								filter: { kind: "graph.derive.rule" },
							},
						},
						where: {
							$expr: {
								"===": [
									{ var: "row.rule.attributes.subject" },
									"openspec.derivation.v1",
								],
							},
						},
						result: {
							cardinality: "many",
							value: { $expr: { var: "row.rule.attributes" } },
						},
					},
					{
						id: "derivation.ruleById",
						sources: {
							rule: {
								kind: "nodes",
								filter: { kind: "graph.derive.rule" },
							},
						},
						where: {
							$expr: {
								and: [
									{
										"===": [
											{ var: "row.rule.attributes.subject" },
											"openspec.derivation.v1",
										],
									},
									{
										"===": [
											{ var: "row.rule.attributes.id" },
											{ var: "parameter.id" },
										],
									},
								],
							},
						},
						result: {
							cardinality: "one",
							value: { $expr: { var: "row.rule.attributes" } },
						},
					},
				],
			},
		},
	];
}

function helperSelectorsProtocol() {
	return defineProtocol<unknown>({
		id: "derived.v1",
		lower(_document, context): SemanticContribution {
			return {
				protocol: context.document.protocol,
				documentId: context.document.id,
			};
		},
			selectors: {
				toyNodeIds(_input, { runtime }) {
					return runtime
						.nodes({ kind: semanticFactKind("toy.node") })
						.map((node) => node.id);
				},
				toyNodes(_input, { runtime }) {
					return runtime.nodes({ kind: semanticFactKind("toy.node") });
				},
				derivedSeeds(_input, { runtime }) {
					return runtime.nodes({ kind: semanticFactKind("derived.seed") });
				},
		},
	});
}
