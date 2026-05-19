import type { JsonObject, SourceRef } from "@openspec/kernel";

export type CompileDocumentInput = {
	id?: string;
	protocol: string;
	document: unknown;
	source?: SourceRef;
	metadata?: JsonObject;
};

export type NormalizedCompileDocument = {
	id: string;
	protocol: string;
	document: unknown;
	source?: SourceRef;
	metadata?: JsonObject;
	index: number;
};
