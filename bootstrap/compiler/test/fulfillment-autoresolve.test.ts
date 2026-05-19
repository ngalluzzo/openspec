import { describe, expect, test } from "bun:test";
import {
	createGraphRuntime,
	createGraphSelectorMaterializer,
	type SemanticGraph,
} from "../src/index.ts";

// Builds the selector definition for fulfillment.plans, identical to the one
// declared in planner.graph.openspec.yml. This lets us test the auto-resolve
// path without running the full compiler.
function fulfillmentPlansDefinition() {
	return {
		sources: {
			request: {
				kind: "facets",
				filter: { kind: { $expr: "capability.fulfillment" } },
			},
			adapter: {
				kind: "nodes",
				filter: { kind: { $expr: "adapter.declaration" } },
			},
			asset: { kind: "nodes", filter: { kind: { $expr: "asset.asset" } } },
		},
		where: {
			$expr: {
				and: [
					{
						"===": [
							{ var: "row.request.value.artifact" },
							{ var: "row.asset.id" },
						],
					},
					{
						or: [
							// explicit: facet carries adapter node ID, matches adapter directly
							{
								and: [
									{
										"===": [
											{ var: "row.adapter.id" },
											{ var: "row.request.value.adapter" },
										],
									},
									{
										"===": [
											{ var: "row.adapter.attributes.kind" },
											{ var: "row.request.value.projectionKind" },
										],
									},
								],
							},
							// auto-resolve: no adapter, match by capability + projection kind + params
							{
								and: [
									{ os_is_empty: [{ var: ["row.request.value.adapter", null] }] },
									{
										"===": [
											{ var: "row.adapter.attributes.capability" },
											{ var: "row.request.target" },
										],
									},
									{
										"===": [
											{ var: "row.adapter.attributes.kind" },
											{ var: "row.request.value.projectionKind" },
										],
									},
									{
										or: [
											{
												os_is_empty: [{ var: ["row.request.value.params", null] }],
											},
											{
												object_includes: [
													{ var: ["row.adapter.attributes.params", {}] },
													{ var: ["row.request.value.params", {}] },
												],
											},
										],
									},
								],
							},
						],
					},
				],
			},
		},
		result: {
			cardinality: "many",
			value: {
				$expr: {
					os_object: [
						{
							id: { var: "row.request.value.id" },
							owner: { var: "row.request.value.owner" },
							capability: { var: "row.request.target" },
							projectionKind: { var: "row.request.value.projectionKind" },
							params: { var: ["row.request.value.params", null] },
							artifactNodeId: { var: "row.asset.id" },
							artifactPath: { var: "row.asset.attributes.locator.path" },
							adapterId: { var: "row.adapter.attributes.id" },
						},
					],
				},
			},
		},
	};
}

type TestNode = Record<string, unknown>;
type TestFacet = Record<string, unknown>;

function makeGraph(input: {
	nodes?: TestNode[];
	facets?: TestFacet[];
} = {}): SemanticGraph {
	const selectorNode: TestNode = {
		id: "selector.declaration:fulfillment.plans",
		kind: "selector.declaration",
		attributes: { definition: fulfillmentPlansDefinition() },
	};
	return {
		nodes: [selectorNode, ...(input.nodes ?? [])] as unknown as SemanticGraph["nodes"],
		edges: [] as unknown as SemanticGraph["edges"],
		facets: (input.facets ?? []) as unknown as SemanticGraph["facets"],
	};
}

const CAPABILITY = "capability.capability:model.schema.projection";
const ADAPTER_ID = "zod.model.schema";
const ADAPTER_NODE_ID = `adapter.adapter:${ADAPTER_ID}`;
const ASSET_ID = "asset.asset:my-provider.schema.output";

function baseNodes(): TestNode[] {
	return [
		{
			id: CAPABILITY,
			kind: "capability.capability",
			attributes: { id: "model.schema.projection" },
		},
		{
			id: ADAPTER_NODE_ID,
			kind: "adapter.declaration",
			attributes: {
				id: ADAPTER_ID,
				capability: CAPABILITY,
				kind: "model.schema.projection",
				owner: "provider.provider:zod",
			},
		},
		{
			id: ASSET_ID,
			kind: "asset.asset",
			attributes: {
				locator: { path: "src/generated/schema.ts" },
			},
		},
	];
}

function fulfillmentFacet(overrides: {
	adapter?: string;
	params?: Record<string, unknown>;
} = {}): TestFacet {
	return {
		id: "capability.fulfillment:my-provider.schema",
		kind: "capability.fulfillment",
		target: CAPABILITY,
		value: {
			id: "my-provider.schema",
			owner: "provider.provider:my-provider",
			projectionKind: "model.schema.projection",
			artifact: ASSET_ID,
			...(overrides.adapter !== undefined ? { adapter: overrides.adapter } : {}),
			...(overrides.params !== undefined ? { params: overrides.params } : {}),
		},
	};
}

function graphWith(input: {
	nodes?: TestNode[];
	facetOverrides?: { adapter?: string; params?: Record<string, unknown> };
} = {}): SemanticGraph {
	return makeGraph({
		nodes: [...baseNodes(), ...(input.nodes ?? [])],
		facets: [fulfillmentFacet(input.facetOverrides ?? {})],
	});
}

async function selectPlans(graph: SemanticGraph): Promise<unknown[]> {
	const selectors = await createGraphSelectorMaterializer().materialize({
		graph,
	});
	const runtime = createGraphRuntime(graph, selectors as never);
	return runtime.hasSelector("fulfillment.plans")
		? (runtime.select("fulfillment.plans", {}) as unknown[])
		: [];
}

describe("fulfillment.plans selector auto-resolve", () => {
	test("explicit adapter (facet carries adapter node ID) produces a plan row", async () => {
		const graph = graphWith({ facetOverrides: { adapter: ADAPTER_NODE_ID } });
		const rows = await selectPlans(graph);

		expect(rows).toHaveLength(1);
		const row = rows[0] as Record<string, unknown>;
		expect(row.adapterId).toBe(ADAPTER_ID);
		expect(row.projectionKind).toBe("model.schema.projection");
		expect(row.artifactPath).toBe("src/generated/schema.ts");
	});

	test("auto-resolve (no adapter in facet) matches adapter by capability and projection kind", async () => {
		const graph = graphWith({
			nodes: [{
				id: "adapter.adapter:zod.model.validation",
				kind: "adapter.declaration",
				attributes: {
					id: "zod.model.validation",
					capability: CAPABILITY,
					kind: "model.validation.projection",
					owner: "provider.provider:zod",
				},
			}],
		});
		const rows = await selectPlans(graph);

		expect(rows).toHaveLength(1);
		const row = rows[0] as Record<string, unknown>;
		expect(row.adapterId).toBe(ADAPTER_ID);
		expect(row.capability).toBe(CAPABILITY);
	});

	test("auto-resolve uses params to select a matching adapter", async () => {
		const graph = graphWith({
			nodes: [
				{
					id: "adapter.adapter:go.model.schema",
					kind: "adapter.declaration",
					attributes: {
						id: "go.model.schema",
						capability: CAPABILITY,
						kind: "model.schema.projection",
						owner: "provider.provider:go",
						params: { language: "go" },
					},
				},
				{
					id: "adapter.adapter:python.model.schema",
					kind: "adapter.declaration",
					attributes: {
						id: "python.model.schema",
						capability: CAPABILITY,
						kind: "model.schema.projection",
						owner: "provider.provider:python",
						params: { language: "python", style: "dataclass" },
					},
				},
				{
					id: "adapter.adapter:unused",
					kind: "adapter.declaration",
					attributes: {
						id: "unused",
						capability: "capability.capability:other",
						kind: "model.schema.projection",
						owner: "provider.provider:unused",
					},
				},
			],
			facetOverrides: { params: { language: "python" } },
		});
		const rows = await selectPlans(graph);

		expect(rows).toHaveLength(1);
		const row = rows[0] as Record<string, unknown>;
		expect(row.adapterId).toBe("python.model.schema");
		expect(row.params).toEqual({ language: "python" });
	});

	test("auto-resolve without params includes parameterized adapters", async () => {
		const graph = graphWith({
			nodes: [
				{
					id: "adapter.adapter:python.model.schema",
					kind: "adapter.declaration",
					attributes: {
						id: "python.model.schema",
						capability: CAPABILITY,
						kind: "model.schema.projection",
						owner: "provider.provider:python",
						params: { language: "python" },
					},
				},
				{
					id: "adapter.adapter:unused",
					kind: "adapter.declaration",
					attributes: {
						id: "unused",
						capability: "capability.capability:other",
						kind: "model.schema.projection",
						owner: "provider.provider:unused",
					},
				},
			],
		});
		const rows = await selectPlans(graph);

		expect(rows).toHaveLength(2);
		expect(new Set(rows.map((row) => (row as Record<string, unknown>).adapterId))).toEqual(
			new Set(["zod.model.schema", "python.model.schema"]),
		);
	});

	test("auto-resolve with two adapters for the same capability produces two rows (ambiguity)", async () => {
		const graph = graphWith({
			nodes: [{
				id: "adapter.adapter:zod.model.schema.v2",
				kind: "adapter.declaration",
				attributes: {
					id: "zod.model.schema.v2",
					capability: CAPABILITY,
					kind: "model.schema.projection",
					owner: "provider.provider:zod",
				},
			}],
		});
		const rows = await selectPlans(graph);

		// Two rows — compose will emit a duplicate-ID diagnostic for planning.action
		expect(rows).toHaveLength(2);
		const adapterIds = (rows as Record<string, unknown>[])
			.map((r) => r.adapterId)
			.sort();
		expect(adapterIds).toEqual([ADAPTER_ID, "zod.model.schema.v2"].sort());
	});
});
