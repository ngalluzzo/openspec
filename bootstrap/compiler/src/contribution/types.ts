import type {
	Diagnostic,
	SemanticEdge,
	SemanticFacet,
	SemanticNode,
} from "@openspec/kernel";

export type SemanticContribution = {
	protocol: string;
	documentId: string;
	nodes?: SemanticNode[];
	edges?: SemanticEdge[];
	facets?: SemanticFacet[];
	diagnostics?: Diagnostic[];
};

export type NormalizedSemanticContribution = {
	protocol: string;
	documentId: string;
	nodes: SemanticNode[];
	edges: SemanticEdge[];
	facets: SemanticFacet[];
	diagnostics: Diagnostic[];
};
