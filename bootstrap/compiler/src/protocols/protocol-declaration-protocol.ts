import type { JsonObject, SemanticNode } from "@openspec/kernel";
import { semanticFactKind, semanticNodeId } from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import { defineProtocol } from "../protocol/define-protocol.ts";
import type { ProtocolContext } from "../protocol/types.ts";

type ProtocolDeclarationDocument = {
	id: string;
	kind?: string;
	expressions?: Record<string, unknown>;
	validation?: unknown;
	documentModels?: unknown;
	package?: unknown;
};

export const protocolDeclarationProtocol =
	defineProtocol<ProtocolDeclarationDocument>({
		id: "openspec.protocol.v1",

		parse(doc) {
			if (
				typeof doc !== "object" ||
				doc === null ||
				typeof (doc as ProtocolDeclarationDocument).id !== "string"
			) {
				throw new Error(
					"openspec.protocol.v1 document must have a string 'id' field",
				);
			}
			return doc as ProtocolDeclarationDocument;
		},

		lower(doc, context: ProtocolContext): SemanticContribution {
			const nid = semanticNodeId("protocol.protocol", doc.id);
			const node: SemanticNode = {
				id: nid,
				kind: semanticFactKind("protocol.protocol"),
				attributes: {
					id: doc.id,
					expressions: doc.expressions ?? null,
				} as unknown as JsonObject,
			};
			return {
				protocol: context.document.protocol,
				documentId: context.document.id,
				nodes: [node],
				edges: [],
				facets: [],
			};
		},
	});
