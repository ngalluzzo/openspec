import type { JsonObject } from "@openspec/kernel";
import type { CompileDocumentInput } from "../document/types.ts";
import type { AnyProtocol } from "../protocol/types.ts";
import type { CollectedProtocolPackages } from "./collect.ts";
import type { DefineProtocolPackageInput, ProtocolPackage } from "./types.ts";

export type ProtocolLifecycleStage = "parse" | "lower" | "validate";

export type ProtocolPackageIdentity = {
	id: string;
	version?: string;
};

export type ProtocolDescriptor = {
	id: string;
	version?: string;
	package?: ProtocolPackageIdentity;
	stages: ProtocolLifecycleStage[];
	selectorIds: string[];
};

export type ProtocolPackageDescriptor = {
	id: string;
	version?: string;
	dependencies?: ProtocolPackageIdentity[];
	protocols: ProtocolDescriptor[];
	documents: CompileDocumentInput[];
	metadata?: JsonObject;
};

export type DefineProtocolPackageInputDescriptor = {
	id: string;
	version?: string;
	dependencies?: ProtocolPackageIdentity[];
	protocols?: ProtocolDescriptor[];
	documents?: CompileDocumentInput[];
	metadata?: JsonObject;
};

export type CollectedProtocolPackagesDescriptor = {
	protocols: ProtocolDescriptor[];
	documents: CompileDocumentInput[];
};

export function describeProtocol(protocol: AnyProtocol): ProtocolDescriptor {
	return compactObject({
		id: protocol.id,
		version: protocol.version,
		package: protocol.package
			? compactObject({
					id: protocol.package.id,
					version: protocol.package.version,
				})
			: undefined,
		stages: protocolStages(protocol),
		selectorIds: Object.keys(protocol.selectors ?? {}).sort(),
	});
}

export function describeProtocolPackage(
	protocolPackage: ProtocolPackage,
): ProtocolPackageDescriptor {
	const packageIdentity = protocolPackageIdentity(protocolPackage);
	return compactObject({
		id: protocolPackage.id,
		version: protocolPackage.version,
		dependencies:
			protocolPackage.dependencies.length > 0
				? protocolPackage.dependencies.map(protocolPackageIdentity)
				: undefined,
		protocols: protocolPackage.protocols.map((protocol) =>
			describeProtocolWithPackage(protocol, packageIdentity),
		),
		documents: protocolPackage.documents.map(copyDocument),
		metadata: protocolPackage.metadata,
	});
}

export function describeDefineProtocolPackageInput(
	input: DefineProtocolPackageInput,
): DefineProtocolPackageInputDescriptor {
	const packageIdentity = protocolPackageIdentity(input);
	return compactObject({
		id: input.id,
		version: input.version,
		dependencies: input.dependencies?.map(protocolPackageIdentity),
		protocols: input.protocols?.map((protocol) =>
			describeProtocolWithPackage(protocol, packageIdentity),
		),
		documents: input.documents?.map(copyDocument),
		metadata: input.metadata,
	});
}

export function describeCollectedProtocolPackages(
	collected: CollectedProtocolPackages,
): CollectedProtocolPackagesDescriptor {
	return {
		protocols: collected.protocols.map(describeProtocol),
		documents: collected.documents.map(copyDocument),
	};
}

function protocolStages(protocol: AnyProtocol): ProtocolLifecycleStage[] {
	return [
		...(protocol.parse ? (["parse"] as const) : []),
		"lower",
		...(protocol.validate ? (["validate"] as const) : []),
	];
}

function describeProtocolWithPackage(
	protocol: AnyProtocol,
	packageIdentity: ProtocolPackageIdentity,
): ProtocolDescriptor {
	return {
		...describeProtocol(protocol),
		package: packageIdentity,
	};
}

function protocolPackageIdentity(input: {
	id: string;
	version?: string;
}): ProtocolPackageIdentity {
	return compactObject({
		id: input.id,
		version: input.version,
	});
}

function copyDocument(document: CompileDocumentInput): CompileDocumentInput {
	return {
		...document,
		...(document.metadata ? { metadata: { ...document.metadata } } : {}),
	};
}

function compactObject<T extends Record<string, unknown>>(input: T): T {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	) as T;
}
