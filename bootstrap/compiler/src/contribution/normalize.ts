import type { Provenance } from "@openspec/kernel";
import { attachProvenance } from "../provenance/attach.ts";
import type {
	NormalizedSemanticContribution,
	SemanticContribution,
} from "./types.ts";

export function normalizeContribution(input: {
	contribution: SemanticContribution;
	provenance: Provenance;
}): NormalizedSemanticContribution {
	return {
		protocol: input.contribution.protocol,
		documentId: input.contribution.documentId,
		nodes: (input.contribution.nodes ?? []).map((node) =>
			attachProvenance(node, input.provenance),
		),
		edges: (input.contribution.edges ?? []).map((edge) =>
			attachProvenance(edge, input.provenance),
		),
		facets: (input.contribution.facets ?? []).map((facet) =>
			attachProvenance(facet, input.provenance),
		),
		diagnostics: [...(input.contribution.diagnostics ?? [])],
	};
}
