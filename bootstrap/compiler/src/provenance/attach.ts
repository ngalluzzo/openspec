import type {
	Provenance,
	SemanticEdge,
	SemanticFacet,
	SemanticNode,
} from "@openspec/kernel";

export function attachProvenance<
	TFact extends SemanticNode | SemanticEdge | SemanticFacet,
>(fact: TFact, provenance: Provenance): TFact {
	return {
		...fact,
		provenance: [...(fact.provenance ?? []), provenance],
	};
}
