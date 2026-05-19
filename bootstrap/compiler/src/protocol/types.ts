import type {
	Diagnostic,
	SemanticGraph,
	GraphRuntime,
	GraphSelector,
} from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import type { NormalizedCompileDocument } from "../document/types.ts";
import type { ExpressionEvaluatorSlot } from "../slots.ts";

export type ProtocolContext = {
	document: NormalizedCompileDocument;
	expressionEvaluator?: ExpressionEvaluatorSlot;
};

export type ProtocolValidationContext = {
	runtime: GraphRuntime;
	documents: NormalizedCompileDocument[];
};

type ProtocolParse<TDocument> = {
	parse(
		document: unknown,
		context: ProtocolContext,
	): TDocument | Promise<TDocument>;
}["parse"];

type ProtocolLower<TDocument> = {
	lower(
		document: TDocument,
		context: ProtocolContext,
	): SemanticContribution | Promise<SemanticContribution>;
}["lower"];

export type AnyProtocol = Protocol<unknown>;

export type Protocol<TDocument = unknown> = {
	id: string;
	version?: string;
	package?: {
		id: string;
		version?: string;
	};
	parse?: ProtocolParse<TDocument>;
	lower: ProtocolLower<TDocument>;
	validate?: (
		graph: SemanticGraph,
		context: ProtocolValidationContext,
	) => Diagnostic[] | Promise<Diagnostic[]>;
	selectors?: Record<string, GraphSelector>;
};
