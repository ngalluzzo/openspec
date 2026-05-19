import {
	semanticFactKind,
	semanticNodeId,
	type SemanticNode,
} from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import type { DefineProtocolPackageInput, ProtocolPackage } from "./types.ts";

export function defineProtocolPackage(
	input: DefineProtocolPackageInput,
): ProtocolPackage {
	const contribution = mergePassDeclarations(
		input.contribution,
		input.passes,
		input.id,
	);
	return {
		id: input.id,
		...(input.version ? { version: input.version } : {}),
		dependencies: [...(input.dependencies ?? [])],
		protocols: [...(input.protocols ?? [])],
		documents: [...(input.documents ?? [])],
		...(contribution ? { contribution } : {}),
		...(input.passes?.length ? { passes: [...input.passes] } : {}),
		...(input.metadata ? { metadata: input.metadata } : {}),
	};
}

function mergePassDeclarations(
	base: SemanticContribution | undefined,
	passes: DefineProtocolPackageInput["passes"],
	packageId: string,
): SemanticContribution | undefined {
	if (!passes?.length) return base;
	const passNodes: SemanticNode[] = passes.map((pass) => ({
		id: semanticNodeId("pass.declaration", pass.id),
		kind: semanticFactKind("pass.declaration"),
		attributes: {
			id: pass.id,
			package: packageId,
			reads: [...pass.reads],
			writes: [...pass.writes],
		},
	}));
	if (!base) {
		return {
			protocol: "openspec.meta",
			documentId: packageId,
			nodes: passNodes,
		};
	}
	return { ...base, nodes: [...(base.nodes ?? []), ...passNodes] };
}
