import { describe, expect, test } from "bun:test";
import type { SemanticGraph } from "@openspec/compiler";
import type { ProjectionExecuteAdapter } from "@openspec/projection-execute-capability";
import { createActionExecutorAdapter } from "../src/index.ts";

function makeGraph(nodes: SemanticGraph["nodes"]): SemanticGraph {
	const edges: SemanticGraph["edges"] = [];
	const normalized = nodes.map((node) => {
		if (node.kind !== "projection.materializer") return node;
		const attrs = node.attributes as Record<string, unknown> | undefined;
		if (!attrs) return node;
		if (typeof attrs.adapter === "string") {
			edges.push({
				id: `${node.id}.adapter.${attrs.adapter}`,
				kind: "projection.materializer.adapter",
				from: node.id,
				to: attrs.adapter,
			} as SemanticGraph["edges"][number]);
		}
		if (typeof attrs.selector === "string") {
			edges.push({
				id: `${node.id}.selector.${attrs.selector}`,
				kind: "projection.materializer.selector",
				from: node.id,
				to: attrs.selector,
			} as SemanticGraph["edges"][number]);
		}
		const { adapter: _adapter, selector: _selector, ...rest } = attrs;
		return { ...node, attributes: rest };
	});
	return { nodes: normalized, edges, facets: [] };
}

function makePlanningAction(
	id: string,
	projectionKind: string,
	owner: string,
	artifactPath: string,
	projectionInputs: unknown,
	extra: Record<string, unknown> = {},
): SemanticGraph["nodes"][number] {
	return {
		id: `planning.action:${id}` as ReturnType<typeof String>,
		kind: "planning.action",
		attributes: {
			id,
			owner,
			projectionKind,
			artifactPath,
			projectionInputs,
			...extra,
		},
	};
}

function mockAdapter(captured: unknown[]): ProjectionExecuteAdapter {
	return {
		async project({ action }) {
			captured.push(action.projectionInputs);
			return {
				diagnostics: [],
				files: [{ path: action.artifactPath, text: "// ok" }],
			};
		},
	};
}

describe("artifactRef resolution", () => {
	test("resolves artifactRef in projectionInputs to the matching action's artifactPath", async () => {
		const schemaInputs: unknown[] = [];
		const validationInputs: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "model.schema.projection", adapter: mockAdapter(schemaInputs) },
				{
					kind: "model.validation.projection",
					adapter: mockAdapter(validationInputs),
				},
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"schema",
				"model.schema.projection",
				"provider.provider:my-provider",
				"src/generated/schema.ts",
				null,
			),
			makePlanningAction(
				"validation",
				"model.validation.projection",
				"provider.provider:my-provider",
				"src/generated/validation.ts",
				{
					schema: {
						artifactRef: {
							projectionKind: "model.schema.projection",
							owner: "provider.provider:my-provider",
						},
					},
				},
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(schemaInputs).toHaveLength(1);
		expect(schemaInputs[0]).toBeNull();

		expect(validationInputs).toHaveLength(1);
		expect(validationInputs[0]).toEqual({ schema: "src/generated/schema.ts" });
	});

	test("resolves nested and array artifactRef values", async () => {
		const captured: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "target.projection", adapter: mockAdapter([]) },
				{
					kind: "consumer.projection",
					adapter: mockAdapter(captured),
				},
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"target",
				"target.projection",
				"provider.provider:p",
				"out/target.ts",
				null,
			),
			makePlanningAction(
				"consumer",
				"consumer.projection",
				"provider.provider:p",
				"out/consumer.ts",
				{
					nested: {
						deep: {
							artifactRef: {
								projectionKind: "target.projection",
								owner: "provider.provider:p",
							},
						},
					},
					list: [
						{
							artifactRef: {
								projectionKind: "target.projection",
								owner: "provider.provider:p",
							},
						},
					],
				},
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(captured[0]).toEqual({
			nested: { deep: "out/target.ts" },
			list: ["out/target.ts"],
		});
	});

	test("throws with planner.artifactRef.unresolved when no matching action exists", async () => {
		const adapter = createActionExecutorAdapter({
			adapters: [{ kind: "consumer.projection", adapter: mockAdapter([]) }],
		});

		const graph = makeGraph([
			makePlanningAction(
				"consumer",
				"consumer.projection",
				"provider.provider:p",
				"out/consumer.ts",
				{
					missing: {
						artifactRef: {
							projectionKind: "nonexistent.projection",
							owner: "provider.provider:p",
						},
					},
				},
			),
		]);

		await expect(adapter.execute({ root: ".", graph })).rejects.toThrow(
			"planner.artifactRef.unresolved",
		);
	});

	test("throws with planner.artifactRef.ambiguous when broad criteria match multiple actions", async () => {
		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "runtime.manifest", adapter: mockAdapter([]) },
				{ kind: "consumer.projection", adapter: mockAdapter([]) },
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"createDeal.runtime",
				"runtime.manifest",
				"provider.provider:crm",
				"out/createDeal.runtime.json",
				{ operation: "operation.operation:crm.createDeal" },
			),
			makePlanningAction(
				"deleteDeal.runtime",
				"runtime.manifest",
				"provider.provider:crm",
				"out/deleteDeal.runtime.json",
				{ operation: "operation.operation:crm.deleteDeal" },
			),
			makePlanningAction(
				"consumer",
				"consumer.projection",
				"provider.provider:crm",
				"out/consumer.ts",
				{
					manifest: {
						artifactRef: {
							projectionKind: "runtime.manifest",
							owner: "provider.provider:crm",
						},
					},
				},
			),
		]);

		await expect(adapter.execute({ root: ".", graph })).rejects.toThrow(
			"planner.artifactRef.ambiguous",
		);
	});

	test("resolves artifactRef with a target discriminator", async () => {
		const captured: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "runtime.manifest", adapter: mockAdapter([]) },
				{ kind: "consumer.projection", adapter: mockAdapter(captured) },
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"createDeal.runtime",
				"runtime.manifest",
				"provider.provider:crm",
				"out/createDeal.runtime.json",
				{ operation: "operation.operation:crm.createDeal" },
			),
			makePlanningAction(
				"deleteDeal.runtime",
				"runtime.manifest",
				"provider.provider:crm",
				"out/deleteDeal.runtime.json",
				{ operation: "operation.operation:crm.deleteDeal" },
			),
			makePlanningAction(
				"consumer",
				"consumer.projection",
				"provider.provider:crm",
				"out/consumer.ts",
				{
					manifest: {
						artifactRef: {
							projectionKind: "runtime.manifest",
							owner: "provider.provider:crm",
							target: "operation.operation:crm.createDeal",
						},
					},
				},
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(captured[0]).toEqual({ manifest: "out/createDeal.runtime.json" });
	});

	test("resolves artifactRef with action and artifact node discriminators", async () => {
		const captured: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "target.projection", adapter: mockAdapter([]) },
				{ kind: "consumer.projection", adapter: mockAdapter(captured) },
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"target.alpha",
				"target.projection",
				"provider.provider:p",
				"out/alpha.json",
				null,
				{ artifactNodeId: "asset.asset:target.alpha.output" },
			),
			makePlanningAction(
				"target.beta",
				"target.projection",
				"provider.provider:p",
				"out/beta.json",
				null,
				{ artifactNodeId: "asset.asset:target.beta.output" },
			),
			makePlanningAction(
				"consumer",
				"consumer.projection",
				"provider.provider:p",
				"out/consumer.ts",
				{
					byAction: { artifactRef: { actionId: "target.alpha" } },
					byArtifact: {
						artifactRef: { artifactNodeId: "asset.asset:target.beta.output" },
					},
				},
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(captured[0]).toEqual({
			byAction: "out/alpha.json",
			byArtifact: "out/beta.json",
		});
	});

	test("dispatches by adapterId when multiple adapters share projectionKind", async () => {
		const first: unknown[] = [];
		const second: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "adapter.first",
					kind: "projection.model.schema",
					adapter: mockAdapter(first),
				},
				{
					id: "adapter.second",
					kind: "projection.model.schema",
					adapter: mockAdapter(second),
				},
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"schema",
				"projection.model.schema",
				"provider.provider:p",
				"out/schema.ts",
				{ owner: "model.package:p", format: "zod" },
				{ adapterId: "adapter.second" },
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(first).toHaveLength(0);
		expect(second).toEqual([{ owner: "model.package:p", format: "zod" }]);
	});

	test("uses projection.materializer selector to build adapter input", async () => {
		const captured: unknown[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "zod.model.schema.projection",
					kind: "projection.model.schema",
					adapter: mockAdapter(captured),
				},
			],
		});

		const graph = makeGraph([
			{
				id: "selector.declaration:zod.schema.declarationsForOwner",
				kind: "selector.declaration",
				attributes: {
					definition: {
						sources: {
							declaration: {
								kind: "nodes",
								filter: { kind: { $expr: "zod.schema.declaration" } },
							},
						},
						where: {
							$expr: {
								"===": [
									{ var: "row.declaration.attributes.owner" },
									{ var: "parameter.owner" },
								],
							},
						},
						result: {
							cardinality: "many",
							value: { $expr: { var: "row.declaration.attributes" } },
						},
					},
				},
			},
			{
				id: "projection.materializer:zod.model.schema.projection",
				kind: "projection.materializer",
				attributes: {
					id: "zod.model.schema.projection",
					projectionKind: "projection.model.schema",
					adapter: "adapter.adapter:zod.model.schema.projection",
					selector: "selector.declaration:zod.schema.declarationsForOwner",
					paramsSource: "projectionInputs.paramsOrOwner",
				},
			},
			{
				id: "zod.schema.declaration:Account",
				kind: "zod.schema.declaration",
				attributes: {
					owner: "model.package:crm",
					name: "Account",
					schemaName: "AccountSchema",
					declarationKind: "object",
				},
			},
			makePlanningAction(
				"schema",
				"projection.model.schema",
				"provider.provider:crm",
				"out/schema.ts",
				{ owner: "model.package:crm", language: "typescript" },
				{ adapterId: "zod.model.schema.projection" },
			),
		]);

		await adapter.execute({ root: ".", graph });

		expect(captured).toEqual([
			[
				{
					owner: "model.package:crm",
					name: "Account",
					schemaName: "AccountSchema",
					declarationKind: "object",
				},
			],
		]);
	});

	test("requires adapterId when projectionKind matches multiple adapters", async () => {
		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "adapter.first",
					kind: "projection.model.schema",
					adapter: mockAdapter([]),
				},
				{
					id: "adapter.second",
					kind: "projection.model.schema",
					adapter: mockAdapter([]),
				},
			],
		});

		const graph = makeGraph([
			makePlanningAction(
				"schema",
				"projection.model.schema",
				"provider.provider:p",
				"out/schema.ts",
				{ owner: "model.package:p", format: "zod" },
			),
		]);

		await expect(adapter.execute({ root: ".", graph })).rejects.toThrow(
			"planner.adapter.ambiguous",
		);
	});
});
