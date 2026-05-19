import type {
	CompileDocumentInput,
	NormalizedCompileDocument,
} from "./types.ts";

export function normalizeDocuments(
	documents: readonly CompileDocumentInput[],
): NormalizedCompileDocument[] {
	return documents.map((document, index) => ({
		id: document.id ?? defaultDocumentId(document, index),
		protocol: document.protocol,
		document: document.document,
		...(document.source ? { source: document.source } : {}),
		...(document.metadata ? { metadata: document.metadata } : {}),
		index,
	}));
}

function defaultDocumentId(
	document: CompileDocumentInput,
	index: number,
): string {
	return document.source?.path ?? `${document.protocol}#${index}`;
}
