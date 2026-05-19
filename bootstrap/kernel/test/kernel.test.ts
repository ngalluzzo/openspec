import { describe, expect, test } from "bun:test";
import {
	error,
	type SemanticGraph,
	semanticFactKind,
	semanticNodeId,
} from "../src/index.ts";

describe("@openspec/kernel", () => {
	test("defines semantic graph ids and diagnostics", () => {
		const nodeId = semanticNodeId("test.node", "alpha");
		const factKind = semanticFactKind("test.node");
		const graph: SemanticGraph = {
			nodes: [{ id: nodeId, kind: factKind }],
			edges: [],
			facets: [],
		};
		const diagnostic = error({
			code: "test.error",
			message: "Test diagnostic.",
			details: { nodeId },
		});

		expect(String(nodeId)).toBe("test.node:alpha");
		expect(graph.nodes[0]).toEqual({ id: nodeId, kind: factKind });
		expect(diagnostic).toMatchObject({
			severity: "error",
			code: "test.error",
		});
	});
});
