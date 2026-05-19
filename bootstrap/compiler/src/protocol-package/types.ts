import type { DerivationPass, JsonObject } from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import type { CompileDocumentInput } from "../document/types.ts";
import type { AnyProtocol } from "../protocol/types.ts";

export type ProtocolPackage = {
	id: string;
	version?: string;
	dependencies: readonly ProtocolPackage[];
	protocols: readonly AnyProtocol[];
	documents: readonly CompileDocumentInput[];
	contribution?: SemanticContribution;
	passes?: readonly DerivationPass[];
	metadata?: JsonObject;
};

export type DefineProtocolPackageInput = {
	id: string;
	version?: string;
	dependencies?: readonly ProtocolPackage[];
	protocols?: readonly AnyProtocol[];
	documents?: readonly CompileDocumentInput[];
	contribution?: SemanticContribution;
	passes?: readonly DerivationPass[];
	metadata?: JsonObject;
};
