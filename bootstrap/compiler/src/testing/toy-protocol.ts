import {
	type Diagnostic,
	error,
	type SemanticNodeId,
	type GraphSelector,
	semanticEdgeId,
	semanticFacetId,
	semanticFactKind,
	semanticNodeId,
} from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import { defineProtocol } from "../protocol/define-protocol.ts";
import type { Protocol } from "../protocol/types.ts";
import { defineProtocolPackage } from "../protocol-package/define-package.ts";
import type { ProtocolPackage } from "../protocol-package/types.ts";

export type ToyDocument = {
	nodes?: Array<{
		id: string;
		kind?: string;
		label?: string;
	}>;
	edges?: Array<{
		id: string;
		kind?: string;
		from: string;
		to: string;
	}>;
	facets?: Array<{
		id: string;
		kind?: string;
		target: string;
		value: string;
	}>;
	requireNode?: string;
};

export const toyNodeIds: GraphSelector<string[], { kind?: string }> = (
	input,
	{ runtime },
) =>
	runtime.nodes(input.kind ? { kind: input.kind } : {}).map((node) => node.id);

export function toyNodeId(id: string): SemanticNodeId {
	return semanticNodeId("toy.node", id);
}

export function toyProtocol(id = "toy.v1"): Protocol<ToyDocument> {
	return defineProtocol<ToyDocument>({
		id,
		parse(document) {
			return document as ToyDocument;
		},
		lower(document, context): SemanticContribution {
			return {
				protocol: context.document.protocol,
				documentId: context.document.id,
				nodes: (document.nodes ?? []).map((node) => ({
					id: toyNodeId(node.id),
					kind: semanticFactKind(node.kind ?? "toy.node"),
					...(node.label
						? {
								attributes: {
									label: node.label,
								},
							}
						: {}),
				})),
				edges: (document.edges ?? []).map((edge) => ({
					id: semanticEdgeId(edge.id),
					kind: semanticFactKind(edge.kind ?? "toy.edge"),
					from: toyNodeId(edge.from),
					to: toyNodeId(edge.to),
				})),
				facets: (document.facets ?? []).map((facet) => ({
					id: semanticFacetId(facet.id),
					kind: semanticFactKind(facet.kind ?? "toy.facet"),
					target: toyNodeId(facet.target),
					value: facet.value,
				})),
			};
		},
		validate(_graph, { runtime, documents }): Diagnostic[] {
			return documents.flatMap((document) => {
				const body = document.document as ToyDocument;
				if (!body.requireNode || runtime.node(body.requireNode)) return [];
				return [
					error({
						code: "toy.requiredNodeMissing",
						message: `Required node '${body.requireNode}' was not found.`,
						source: document.source,
					}),
				];
			});
		},
		selectors: {
			nodeIds: toyNodeIds,
		},
	});
}

export function toyProtocolPackage(): ProtocolPackage {
	return defineProtocolPackage({
		id: "toy.package",
		version: "1.0.0",
		protocols: [toyProtocol()],
		documents: [
			{
				id: "toy.package.model",
				protocol: "toy.v1",
				source: {
					path: "toy.package.yml",
				},
				document: {
					nodes: [
						{
							id: "toy.SemanticNode",
							kind: "toy.model",
							label: "SemanticNode",
						},
					],
				},
			},
		],
	});
}
