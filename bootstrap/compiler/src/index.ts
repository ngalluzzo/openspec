export type {
	Brand,
	DerivationPass,
	DerivationPassContext,
	DerivationPassResult,
	Diagnostic,
	DiagnosticInput,
	DiagnosticSeverity,
	DiagnosticSource,
	DocumentId,
	EdgeFilter,
	FacetFilter,
	JsonObject,
	JsonPrimitive,
	JsonValue,
	GraphIndexes,
	NeighborFilter,
	NodeFilter,
	NodeLookupResult,
	ProtocolId,
	Provenance,
	SemanticEdge,
	SemanticEdgeId,
	SemanticFacet,
	SemanticFacetId,
	SemanticFactKind,
	SemanticGraph,
	SemanticGraphQuery,
	GraphSnapshot,
	SemanticNode,
	SemanticNodeId,
	SemanticNodeRef,
	GraphRuntime,
	GraphSelector,
	GraphSelectorContext,
	SourceRef,
} from "@openspec/kernel";
export {
	defineDerivationPass,
	diagnostic,
	documentId,
	error,
	info,
	NODE_ID_FORMAT,
	protocolId,
	semanticEdgeId,
	semanticFacetId,
	semanticFactKind,
	semanticNodeId,
	warning,
} from "@openspec/kernel";
export {
	type CompileInput,
	type CompileResult,
	type Compiler,
	type CompilerCapabilitySlots,
	type CreateCompilerInput,
	createCompiler,
	type DynamicLowerer,
	type DynamicLoweringSlot,
	type DynamicValidationSlot,
	type ExpressionEvaluatorSlot,
	type GraphProviderSlot,
	type SelectorEvaluatorSlot,
} from "./compile/compiler.ts";
export {
	type CompileRunDescriptor,
	type CompileRunInputDescriptor,
	type CompileRunOutputDescriptor,
	type DescribeCompileRunInput,
	describeCompileRun,
	describeCompilerRun,
} from "./compile/run-descriptor.ts";
export { type CompileTraceEvent, traceEvent } from "./compile/trace.ts";
export type {
	NormalizedSemanticContribution,
	SemanticContribution,
} from "./contribution/types.ts";
export type {
	CompileDocumentInput,
	NormalizedCompileDocument,
} from "./document/types.ts";
export type {
	HostDocument,
	HostEnvironmentContract,
	HostMethodDispatchContract,
	HostMethodDispatchesSelectorResult,
	HostMethodDispatchSelectorContract,
	HostSelectorNoParams,
} from "./generated/host-types.generated.ts";
export {
	createMemoryGraphProvider,
	type GraphTraverserSlot,
	type MemoryGraphProviderOptions,
} from "./graph/memory-provider.ts";
export { createGraphRuntime } from "./graph/runtime.ts";
export { createDynamicLowerer } from "./lowering/dynamic-lowerer.ts";
export { defineProtocol } from "./protocol/define-protocol.ts";
export type {
	AnyProtocol,
	Protocol,
	ProtocolContext,
	ProtocolValidationContext,
} from "./protocol/types.ts";
export {
	type CollectedProtocolPackages,
	collectProtocolPackages,
} from "./protocol-package/collect.ts";
export { defineProtocolPackage } from "./protocol-package/define-package.ts";
export {
	type CollectedProtocolPackagesDescriptor,
	type DefineProtocolPackageInputDescriptor,
	describeCollectedProtocolPackages,
	describeDefineProtocolPackageInput,
	describeProtocol,
	describeProtocolPackage,
	type ProtocolDescriptor,
	type ProtocolLifecycleStage,
	type ProtocolPackageDescriptor,
	type ProtocolPackageIdentity,
} from "./protocol-package/descriptor.ts";
export { protocolDocument } from "./protocol-package/document.ts";
export type {
	DefineProtocolPackageInput,
	ProtocolPackage,
} from "./protocol-package/types.ts";
export { createGraphSelectorMaterializer } from "./selectors/graph-selector-materializer.ts";
export { runSelector } from "./selectors/run-selector.ts";
