import {
	type Diagnostic,
	error,
	NODE_ID_FORMAT,
	type SemanticEdge,
	type SemanticFacet,
	type SemanticGraph,
	type SemanticNode,
} from "@openspec/kernel";
import type { NormalizedSemanticContribution } from "../contribution/types.ts";
import { mergeEdge, mergeFacet, mergeNode } from "./conflicts.ts";

export type ComposeGraphResult = {
	graph: SemanticGraph;
	diagnostics: Diagnostic[];
};

// Merges contributions into a unified graph. Duplicate node/edge/facet IDs are
// intentional: multiple documents can assert the same logical entity, and their
// facts are merged here. Conflicting attribute values produce a diagnostic rather
// than silently overwriting.
export function composeGraph(
	contributions: readonly NormalizedSemanticContribution[],
): ComposeGraphResult {
	const nodes = new Map<string, SemanticNode>();
	const edges = new Map<string, SemanticEdge>();
	const facets = new Map<string, SemanticFacet>();
	const diagnostics = contributions.flatMap(
		(contribution) => contribution.diagnostics,
	);

	for (const contribution of contributions) {
		for (const node of contribution.nodes) {
			const existing = nodes.get(node.id);
			if (!existing) {
				nodes.set(node.id, node);
				continue;
			}
			const merged = mergeNode(existing, node);
			if (merged.ok) {
				nodes.set(node.id, merged.fact);
			} else {
				diagnostics.push(merged.diagnostic);
			}
		}

		for (const edge of contribution.edges) {
			const existing = edges.get(edge.id);
			if (!existing) {
				edges.set(edge.id, edge);
				continue;
			}
			const merged = mergeEdge(existing, edge);
			if (merged.ok) {
				edges.set(edge.id, merged.fact);
			} else {
				diagnostics.push(merged.diagnostic);
			}
		}

		for (const facet of contribution.facets) {
			const existing = facets.get(facet.id);
			if (!existing) {
				facets.set(facet.id, facet);
				continue;
			}
			const merged = mergeFacet(existing, facet);
			if (merged.ok) {
				facets.set(facet.id, merged.fact);
			} else {
				diagnostics.push(merged.diagnostic);
			}
		}
	}

	const graph = {
		nodes: sortById([...nodes.values()]),
		edges: sortById([...edges.values()]),
		facets: sortById([...facets.values()]),
	};

	return {
		graph,
		diagnostics: [
			...diagnostics,
			...invalidNodeIdDiagnostics(graph),
			...missingEndpointDiagnostics(graph),
			...missingFacetTargetDiagnostics(graph),
		],
	};
}

function invalidNodeIdDiagnostics(graph: SemanticGraph): Diagnostic[] {
	return graph.nodes
		.filter((node) => !NODE_ID_FORMAT.test(node.id))
		.map((node) =>
			error({
				code: "graph.node.invalidNodeId",
				message: `Node '${node.id}' does not match the required nodeId format (kind:identifier).`,
				details: {
					node: node.id,
					kind: node.kind,
				},
			}),
		);
}

function missingEndpointDiagnostics(graph: SemanticGraph): Diagnostic[] {
	const nodeIds = new Set(graph.nodes.map((node) => node.id));
	const diagnostics: Diagnostic[] = [];
	for (const edge of graph.edges) {
		if (!nodeIds.has(edge.from) && !deferredSourceEdge(edge)) {
			diagnostics.push(
				error({
					code: "graph.edge.missingFrom",
					message: `Edge '${edge.id}' references missing source node '${edge.from}'.`,
					details: {
						edge: edge.id,
						node: edge.from,
					},
				}),
			);
		}
		if (!nodeIds.has(edge.to) && !deferredTargetEdge(edge)) {
			diagnostics.push(
				error({
					code: "graph.edge.missingTo",
					message: `Edge '${edge.id}' references missing target node '${edge.to}'.`,
					details: {
						edge: edge.id,
						node: edge.to,
					},
				}),
			);
		}
	}
	return diagnostics;
}

function deferredSourceEdge(edge: SemanticEdge): boolean {
	return (
		edge.kind === "model.owner.declaration" ||
		edge.kind === "capability.owner.declaration" ||
		edge.kind === "capability.owner.capability" ||
		edge.kind === "asset.owner.asset" ||
		edge.kind === "binding.owner.binding" ||
		edge.kind === "graph.selector.declaration" ||
		edge.kind === "adapter.owner.declaration"
	);
}

function deferredTargetEdge(edge: SemanticEdge): boolean {
	return (
		edge.kind === "adapter.projection.select" &&
		String(edge.to).startsWith("selector.declaration:")
	);
}

function missingFacetTargetDiagnostics(graph: SemanticGraph): Diagnostic[] {
	const nodeIds = new Set(graph.nodes.map((node) => node.id));
	return graph.facets
		.filter((facet) => !nodeIds.has(facet.target))
		.map((facet) =>
			error({
				code: "graph.facet.missingTarget",
				message: `Facet '${facet.id}' references missing target '${facet.target}'.`,
				details: {
					facet: facet.id,
					target: facet.target,
				},
			}),
		);
}

function sortById<TFact extends { id: string }>(facts: TFact[]): TFact[] {
	return facts.sort((left, right) => left.id.localeCompare(right.id));
}
