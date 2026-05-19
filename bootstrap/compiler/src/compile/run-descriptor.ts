import type { Diagnostic, SemanticGraph } from "@openspec/kernel";
import type { CompileDocumentInput } from "../document/types.ts";
import type { AnyProtocol } from "../protocol/types.ts";
import {
	describeProtocol,
	describeProtocolPackage,
	type ProtocolDescriptor,
	type ProtocolPackageDescriptor,
} from "../protocol-package/descriptor.ts";
import type { ProtocolPackage } from "../protocol-package/types.ts";
import type {
	CompileInput,
	CompileResult,
	CreateCompilerInput,
} from "./compiler.ts";
import type { CompileTraceEvent } from "./trace.ts";

export type CompileRunInputDescriptor = {
	documents: CompileDocumentInput[];
	protocols: ProtocolDescriptor[];
	protocolPackages: ProtocolPackageDescriptor[];
};

export type CompileRunOutputDescriptor = {
	graph: SemanticGraph;
	diagnostics: Diagnostic[];
	trace: CompileTraceEvent[];
};

export type CompileRunDescriptor = {
	input: CompileRunInputDescriptor;
	output: CompileRunOutputDescriptor;
};

export type DescribeCompileRunInput = {
	input: CompileInput;
	result: CompileResult;
	protocols?: readonly AnyProtocol[];
	packages?: readonly ProtocolPackage[];
};

export function describeCompileRun(
	input: DescribeCompileRunInput,
): CompileRunDescriptor {
	return {
		input: {
			documents: input.input.documents.map(copyDocument),
			protocols: (input.protocols ?? []).map(describeProtocol),
			protocolPackages: (input.packages ?? []).map(describeProtocolPackage),
		},
		output: {
			graph: input.result.graph,
			diagnostics: [...input.result.diagnostics],
			trace: [...input.result.trace],
		},
	};
}

export function describeCompilerRun(
	input: CreateCompilerInput & {
		input: CompileInput;
		result: CompileResult;
	},
): CompileRunDescriptor {
	return describeCompileRun({
		input: input.input,
		result: input.result,
		protocols: input.protocols,
		packages: input.packages,
	});
}

function copyDocument(document: CompileDocumentInput): CompileDocumentInput {
	return {
		...document,
		...(document.metadata ? { metadata: { ...document.metadata } } : {}),
	};
}
