import { describe, expect, test } from "bun:test";
import {
	createGraphRuntime,
	type GraphSelector,
	type SemanticEdge,
	type SemanticEdgeId,
	type SemanticFacetId,
	type SemanticFactKind,
	type SemanticGraph,
	type SemanticNode,
	type SemanticNodeId,
} from "../src/index.ts";

describe("graph runtime", () => {
	test("memoizes selector results for a snapshot and params", () => {
		let calls = 0;
		const graph = graphWithChain(3);
		const selector: GraphSelector<string[], { kind?: string }> = (
			input,
			{ runtime },
		) => {
			calls += 1;
		return runtime.nodes(input).map((node) => String(node.id));
		};
		const runtime = createGraphRuntime(graph, { nodeIds: selector });

		const first = runtime.select<string[]>("nodeIds", { kind: "test.node" });
		const second = runtime.select<string[]>("nodeIds", { kind: "test.node" });

		expect(first).toBe(second);
		expect(first).toEqual(["test.node:0", "test.node:1", "test.node:2"]);
		expect(Object.isFrozen(first)).toBe(true);
		expect(calls).toBe(1);
	});

	test("separates selector caches by runtime snapshot", () => {
		let calls = 0;
		const selector: GraphSelector<number> = (_input, { runtime }) => {
			calls += 1;
			return runtime.nodes({ kind: "test.node" }).length;
		};

		const firstRuntime = createGraphRuntime(graphWithChain(1), { count: selector });
		const secondRuntime = createGraphRuntime(graphWithChain(2), { count: selector });

		expect(firstRuntime.select<number>("count", {})).toBe(1);
		expect(firstRuntime.select<number>("count", {})).toBe(1);
		expect(secondRuntime.select<number>("count", {})).toBe(2);
		expect(calls).toBe(2);
	});

	test("uses indexed graph lookups for nodes, edges, facets, and neighbors", () => {
		const runtime = createGraphRuntime(graphWithChain(2_000));

		expect(String(runtime.node("test.node:1444")?.id)).toBe("test.node:1444");
		expect(runtime.nodes({ kind: "other.node" })).toHaveLength(1);
		expect(
			runtime.edges({ kind: "test.edge", from: "test.node:1444" }) as unknown,
		).toEqual([
			{
				id: "test.edge:1444",
				kind: "test.edge",
				from: "test.node:1444",
				to: "test.node:1445",
			},
		] as unknown);
		expect(
			runtime.neighbors("test.node:1444", {
				kind: "test.edge",
				direction: "out",
			}) as unknown,
		).toEqual([
			{
				id: "test.node:1445",
				kind: "test.node",
			},
		] as unknown);
		expect(
			runtime.facets({
				kind: "test.facet",
				target: "test.node:1444",
			}) as unknown,
		)
			.toEqual([
				{
					id: "test.facet:1444",
					kind: "test.facet",
					target: "test.node:1444",
					value: 1444,
				},
			] as unknown);
	});
});

function graphWithChain(size: number): SemanticGraph {
	const nodes: SemanticNode[] = Array.from({ length: size }, (_, index) => ({
		id: nodeId(`test.node:${index}`),
		kind: factKind("test.node"),
	}));
	nodes.push({ id: nodeId("other.node:0"), kind: factKind("other.node") });
	const edges: SemanticEdge[] = Array.from(
		{ length: Math.max(0, size - 1) },
		(_, index) => ({
			id: edgeId(`test.edge:${index}`),
			kind: factKind("test.edge"),
			from: nodeId(`test.node:${index}`),
			to: nodeId(`test.node:${index + 1}`),
		}),
	);
	return {
		nodes,
		edges,
		facets: [
			{
				id: facetId("test.facet:1444"),
				kind: factKind("test.facet"),
				target: nodeId("test.node:1444"),
				value: 1444,
			},
		],
	};
}

function nodeId(value: string): SemanticNodeId {
	return value as SemanticNodeId;
}

function edgeId(value: string): SemanticEdgeId {
	return value as SemanticEdgeId;
}

function facetId(value: string): SemanticFacetId {
	return value as SemanticFacetId;
}

function factKind(value: string): SemanticFactKind {
	return value as SemanticFactKind;
}
