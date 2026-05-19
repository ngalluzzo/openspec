import type { DerivationPass } from "@openspec/kernel";
import type { CompileDocumentInput } from "../document/types.ts";
import type { AnyProtocol } from "../protocol/types.ts";
import type { ProtocolPackage } from "./types.ts";

export type CollectedProtocolPackages = {
	packages: ProtocolPackage[];
	protocols: AnyProtocol[];
	documents: CompileDocumentInput[];
	passes: DerivationPass[];
};

export function collectProtocolPackages(input: {
	protocols?: readonly AnyProtocol[];
	packages?: readonly ProtocolPackage[];
	passes?: readonly DerivationPass[];
}): CollectedProtocolPackages {
	const packages = collectPackages(input.packages ?? []);
	return {
		packages,
		protocols: [
			...(input.protocols ?? []),
			...packages.flatMap((protocolPackage) =>
				protocolPackage.protocols.map((protocol) =>
					protocolWithPackageMetadata(protocol, protocolPackage),
				),
			),
		],
		documents: packages.flatMap((protocolPackage) =>
			protocolPackage.documents.map((document) =>
				documentWithPackageMetadata(document, protocolPackage),
			),
		),
		passes: [
			...(input.passes ?? []),
			...packages.flatMap((protocolPackage) => protocolPackage.passes ?? []),
		],
	};
}

function collectPackages(
	packages: readonly ProtocolPackage[],
): ProtocolPackage[] {
	const byIdentity = new Map<string, ProtocolPackage>();
	const visiting = new Set<string>();
	const visit = (protocolPackage: ProtocolPackage) => {
		const key = packageKey(protocolPackage);
		if (byIdentity.has(key) || visiting.has(key)) return;
		visiting.add(key);
		for (const dependency of protocolPackage.dependencies) {
			visit(dependency);
		}
		visiting.delete(key);
		byIdentity.set(key, protocolPackage);
	};
	for (const protocolPackage of packages) {
		visit(protocolPackage);
	}
	return [...byIdentity.values()];
}

function packageKey(protocolPackage: ProtocolPackage): string {
	return `${protocolPackage.id}@${protocolPackage.version ?? ""}`;
}

function protocolWithPackageMetadata(
	protocol: AnyProtocol,
	protocolPackage: ProtocolPackage,
): AnyProtocol {
	return {
		...protocol,
		package: {
			id: protocolPackage.id,
			...(protocolPackage.version ? { version: protocolPackage.version } : {}),
		},
	};
}

function documentWithPackageMetadata(
	document: CompileDocumentInput,
	protocolPackage: ProtocolPackage,
): CompileDocumentInput {
	return {
		...document,
		metadata: {
			...(document.metadata ?? {}),
			"openspec.package": {
				id: protocolPackage.id,
				...(protocolPackage.version
					? { version: protocolPackage.version }
					: {}),
			},
		},
	};
}
