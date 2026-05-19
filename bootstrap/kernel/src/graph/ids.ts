import type { Brand } from "../identity/brand.ts";

export type ProtocolId = Brand<string, "ProtocolId">;
export type DocumentId = Brand<string, "DocumentId">;

export type SemanticNodeId = Brand<string, "SemanticNodeId">;
export type SemanticEdgeId = Brand<string, "SemanticEdgeId">;
export type SemanticFacetId = Brand<string, "SemanticFacetId">;
export type SemanticFactKind = Brand<string, "SemanticFactKind">;

export function protocolId(value: string): ProtocolId {
	return value as ProtocolId;
}

export function documentId(value: string): DocumentId {
	return value as DocumentId;
}

export const NODE_ID_FORMAT = /^[a-z][a-z0-9.]+:.+$/;

export function semanticNodeId(
	kind: string,
	...segments: string[]
): SemanticNodeId {
	const identifier = segments.join(".");
	const value = `${kind}:${identifier}`;
	if (process.env.NODE_ENV !== "production") {
		if (!NODE_ID_FORMAT.test(value)) {
			throw new Error(
				`Invalid nodeId format: "${value}". Must match /^[a-z][a-z0-9.]+:.+$/, ` +
					`kind="${kind}", segments=[${segments.join(", ")}]`,
			);
		}
	}
	return value as SemanticNodeId;
}

export function semanticEdgeId(value: string): SemanticEdgeId {
	return value as SemanticEdgeId;
}

export function semanticFacetId(value: string): SemanticFacetId {
	return value as SemanticFacetId;
}

export function semanticFactKind(value: string): SemanticFactKind {
	return value as SemanticFactKind;
}
