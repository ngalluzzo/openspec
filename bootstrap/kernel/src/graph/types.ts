import type { JsonObject, JsonValue, Provenance } from "../provenance/types.ts";
import type {
	SemanticEdgeId,
	SemanticFacetId,
	SemanticFactKind,
	SemanticNodeId,
} from "./ids.ts";

export type SemanticNodeRef = {
	nodeId: SemanticNodeId;
};

export type SemanticNode = {
	id: SemanticNodeId;
	kind: SemanticFactKind;
	attributes?: JsonObject;
	provenance?: Provenance[];
};

export type SemanticEdge = {
	id: SemanticEdgeId;
	kind: SemanticFactKind;
	from: SemanticNodeId;
	to: SemanticNodeId;
	attributes?: JsonObject;
	provenance?: Provenance[];
};

// A facet annotates a node with a scalar value from outside the node's own
// contribution. Prefer facets over node attributes when the value comes from a
// different document, is derived by a pass, or needs to be queried by kind
// across many nodes.
export type SemanticFacet = {
	id: SemanticFacetId;
	kind: SemanticFactKind;
	target: SemanticNodeId;
	value: JsonValue;
	provenance?: Provenance[];
};

export type SemanticGraph = {
	nodes: SemanticNode[];
	edges: SemanticEdge[];
	facets: SemanticFacet[];
};
