import {
	type Diagnostic,
	error,
	type SemanticEdge,
	type SemanticFacet,
	type SemanticNode,
} from "@openspec/kernel";

export type MergeResult<TFact> =
	| {
			ok: true;
			fact: TFact;
	  }
	| {
			ok: false;
			diagnostic: Diagnostic;
	  };

export function mergeNode(
	existing: SemanticNode,
	incoming: SemanticNode,
): MergeResult<SemanticNode> {
	if (sameJson(strippedNode(existing), strippedNode(incoming))) {
		return {
			ok: true,
			fact: {
				...existing,
				provenance: mergeProvenance(existing.provenance, incoming.provenance),
			},
		};
	}

	return conflict("graph.node.conflict", "node", existing.id);
}

export function mergeEdge(
	existing: SemanticEdge,
	incoming: SemanticEdge,
): MergeResult<SemanticEdge> {
	if (sameJson(strippedEdge(existing), strippedEdge(incoming))) {
		return {
			ok: true,
			fact: {
				...existing,
				provenance: mergeProvenance(existing.provenance, incoming.provenance),
			},
		};
	}

	return conflict("graph.edge.conflict", "edge", existing.id);
}

export function mergeFacet(
	existing: SemanticFacet,
	incoming: SemanticFacet,
): MergeResult<SemanticFacet> {
	if (sameJson(strippedFacet(existing), strippedFacet(incoming))) {
		return {
			ok: true,
			fact: {
				...existing,
				provenance: mergeProvenance(existing.provenance, incoming.provenance),
			},
		};
	}

	return conflict("graph.facet.conflict", "facet", existing.id);
}

function strippedNode(node: SemanticNode): Omit<SemanticNode, "provenance"> {
	const { provenance: _provenance, ...rest } = node;
	return rest;
}

function strippedEdge(edge: SemanticEdge): Omit<SemanticEdge, "provenance"> {
	const { provenance: _provenance, ...rest } = edge;
	return rest;
}

function strippedFacet(
	facet: SemanticFacet,
): Omit<SemanticFacet, "provenance"> {
	const { provenance: _provenance, ...rest } = facet;
	return rest;
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function mergeProvenance<T>(left: T[] = [], right: T[] = []): T[] {
	return [...left, ...right];
}

function conflict(
	code: string,
	factKind: "node" | "edge" | "facet",
	id: string,
): MergeResult<never> {
	return {
		ok: false,
		diagnostic: error({
			code,
			message: `Conflicting ${factKind} '${id}' was ignored.`,
			details: {
				id,
				factKind,
			},
		}),
	};
}
