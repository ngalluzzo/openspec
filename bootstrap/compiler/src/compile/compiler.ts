import {
	type DerivationPass,
	type Diagnostic,
	error,
	type JsonObject,
	type Provenance,
	type SemanticGraph,
	type GraphRuntime,
	type GraphSelector,
} from "@openspec/kernel";
import { normalizeContribution } from "../contribution/normalize.ts";
import type {
	NormalizedSemanticContribution,
	SemanticContribution,
} from "../contribution/types.ts";
import { normalizeDocuments } from "../document/normalize.ts";
import type {
	CompileDocumentInput,
	NormalizedCompileDocument,
} from "../document/types.ts";
import type { CompilerCapabilitySlots as GeneratedCompilerCapabilitySlots } from "../generated/compiler.types.ts";
import type {
	GraphDocumentLowerAdapter as GraphDocumentLower,
	GraphProvideAdapter as GraphProvide,
	GraphValidateAdapter as GraphValidate,
} from "../generated/graph-capabilities.contracts.ts";
import { composeGraph } from "../graph/compose.ts";
import { createMemoryGraphProvider } from "../graph/memory-provider.ts";
import { createDynamicLowerer } from "../lowering/dynamic-lowerer.ts";
import { expandPatterns } from "../pattern/expand.ts";
import { createProtocolRegistry } from "../protocol/registry.ts";
import type { AnyProtocol } from "../protocol/types.ts";
import { collectProtocolPackages } from "../protocol-package/collect.ts";
import type { ProtocolPackage } from "../protocol-package/types.ts";
import { graphProtocol } from "../protocols/graph-protocol.ts";
import { protocolDeclarationProtocol } from "../protocols/protocol-declaration-protocol.ts";
import { patternProtocol, providerProtocol } from "../protocols/structural-protocols.ts";
import type { ExpressionEvaluatorSlot } from "../slots.ts";
import { runPasses } from "./pass-manager.ts";
import { type CompileTraceEvent, traceEvent } from "./trace.ts";

export type { ExpressionEvaluatorSlot } from "../slots.ts";
export type {
	GraphDocumentLower as DynamicLoweringSlot,
	GraphProvide as GraphProviderSlot,
	GraphValidate as DynamicValidationSlot,
};

// Compiler-specific slot types not covered by capability specs.
export type SelectorEvaluatorSlot = (
	runtime: GraphRuntime,
	selector: string,
	input: unknown,
) => unknown;

// DynamicLowerer is the per-document function returned by GraphDocumentLower.prepare.
export type DynamicLowerer = (
	document: JsonObject,
	protocol: string,
	documentId: string,
) => Promise<SemanticContribution | null>;

// CompilerCapabilitySlots layers strong types over the generated base shape.
export type CompilerCapabilitySlots = Omit<
	GeneratedCompilerCapabilitySlots,
	| "graphProvider"
	| "dynamicLowering"
	| "dynamicValidation"
	| "expressionEvaluator"
> & {
	graphProvider?: GraphProvide;
	dynamicLowering?: GraphDocumentLower;
	dynamicValidation?: GraphValidate;
	expressionEvaluator?: ExpressionEvaluatorSlot;
};

export type CreateCompilerInput = {
	protocols?: readonly AnyProtocol[];
	packages?: readonly ProtocolPackage[];
	passes?: readonly DerivationPass[];
	// Ordered list of phase names. Passes run phase-by-phase in this order;
	// all passes in a phase complete before the next phase begins. Passes
	// without a phase declaration go into "default", appended after named phases.
	phases?: readonly string[];
	strict?: boolean;
	capabilities?: CompilerCapabilitySlots;
};

export type CompileInput = {
	documents: readonly CompileDocumentInput[];
};

export type CompileResult = {
	graph: SemanticGraph;
	runtime: GraphRuntime;
	diagnostics: Diagnostic[];
	trace: CompileTraceEvent[];
};

export type Compiler = {
	compile(input: CompileInput): Promise<CompileResult>;
};

export function createCompiler(input: CreateCompilerInput): Compiler {
	const collected = collectProtocolPackages({
		...input,
		protocols: [graphProtocol, protocolDeclarationProtocol, patternProtocol, providerProtocol, ...(input.protocols ?? [])],
	});
	const registry = createProtocolRegistry(collected.protocols);
	const passes = collected.passes;
	const phases = input.phases;
	const strict = input.strict ?? false;
	const graphProvider =
		input.capabilities?.graphProvider ?? createMemoryGraphProvider();
	const expressionEvaluator = input.capabilities?.expressionEvaluator;
	const dynamicLoweringSlot =
		input.capabilities?.dynamicLowering ?? createDynamicLowerer();
	const dynamicValidation = input.capabilities?.dynamicValidation;

	return {
		async compile(compileInput) {
			const trace: CompileTraceEvent[] = [];
			const diagnostics: Diagnostic[] = [...registry.diagnostics];

			// Pattern expansion: expand openspec.pattern.v1 documents into their
			// target documents before normalization.
			const { expanded: patternExpanded, diagnostics: expansionDiagnostics } =
				await expandPatterns([
					...collected.documents,
					...compileInput.documents,
				]);
			diagnostics.push(...expansionDiagnostics);
			const documents = normalizeDocuments([
				...collected.documents,
				...compileInput.documents,
				...patternExpanded,
			]);
			trace.push(traceEvent({ stage: "document.normalize" }));

			const packageContributions = collected.packages
				.map((protocolPackage, index) =>
					protocolPackage.contribution
						? normalizeContribution({
								contribution: protocolPackage.contribution,
								provenance: {
									protocol: "openspec.meta",
									documentId: protocolPackage.id,
									contribution: index,
								},
							})
						: undefined,
				)
				.filter(
					(contribution): contribution is NormalizedSemanticContribution =>
						contribution !== undefined,
				);
			const contributions: NormalizedSemanticContribution[] = [
				...packageContributions,
			];
			let documentContributionIndex = 0;

			// Pre-pass: compile infrastructure documents first so their
			// protocol.lowering.map and selector.declaration nodes are available
			// to the dynamic lowering and selector materialization slots.
			const prePassDocuments = documents.filter((d) =>
				PRE_PASS_PROTOCOLS.has(d.protocol),
			);
			const mainDocuments = documents.filter(
				(d) => !PRE_PASS_PROTOCOLS.has(d.protocol),
			);

			for (const document of prePassDocuments) {
				const protocol = registry.get(document.protocol);
				if (!protocol) {
					diagnostics.push(unknownProtocolDiagnostic(document));
					continue;
				}
				const parsed = protocol.parse
					? await protocol.parse(document.document, { document })
					: document.document;
				const contribution = await protocol.lower(parsed, {
					document,
					...(expressionEvaluator ? { expressionEvaluator } : {}),
				});
				contributions.push(
					normalizeContribution({
						contribution,
						provenance: provenanceFor(
							document,
							protocol,
							documentContributionIndex,
						),
					}),
				);
				documentContributionIndex += 1;
			}

			// Prepare the dynamic lowerer once from the pre-pass graph.
			// GraphDocumentLower.prepare() is called once; the returned handle is
			// passed to lower() for each document.
			const prePassGraph = composeGraph(contributions).graph;
			const dynamicLowerHandle = dynamicLoweringSlot
				? await dynamicLoweringSlot.prepare({
						graph: prePassGraph,
						evaluator: expressionEvaluator,
					})
				: undefined;

			// Main pass: dynamic lowerer takes priority; falls back to compiled lower().
			for (const document of mainDocuments) {
				const protocol = registry.get(document.protocol);
				if (!protocol) {
					const dynamicContribution =
						dynamicLowerHandle && isJsonObject(document.document)
							? ((await dynamicLoweringSlot?.lower({
									handle: dynamicLowerHandle,
									document: document.document,
									protocol: document.protocol,
									documentId: document.id,
								})) as SemanticContribution | null)
							: null;
					if (!dynamicContribution) {
						diagnostics.push(unknownProtocolDiagnostic(document));
						continue;
					}
					contributions.push(
						normalizeContribution({
							contribution: dynamicContribution,
							provenance: provenanceFor(
								document,
								{ id: document.protocol } as AnyProtocol,
								documentContributionIndex,
							),
						}),
					);
					documentContributionIndex += 1;
					continue;
				}

				trace.push(
					traceEvent({
						stage: "protocol.parse",
						documentId: document.id,
						protocol: protocol.id,
					}),
				);
				const parsed = protocol.parse
					? await protocol.parse(document.document, { document })
					: document.document;

				trace.push(
					traceEvent({
						stage: "protocol.lower",
						documentId: document.id,
						protocol: protocol.id,
					}),
				);
				const contribution =
					(dynamicLowerHandle
						? ((await dynamicLoweringSlot?.lower({
								handle: dynamicLowerHandle,
								document: parsed as JsonObject,
								protocol: document.protocol,
								documentId: document.id,
							})) as SemanticContribution | null)
						: null) ??
					(await protocol.lower(parsed, {
						document,
						...(expressionEvaluator ? { expressionEvaluator } : {}),
					}));
				contributions.push(
					normalizeContribution({
						contribution,
						provenance: provenanceFor(
							document,
							protocol,
							documentContributionIndex,
						),
					}),
				);
				documentContributionIndex += 1;
			}

			// Compose graph and run TypeScript derivation passes — compiler concerns.
			const composed = composeGraph(contributions);
			diagnostics.push(...composed.diagnostics);

			const passResult = await runPasses(passes, contributions, undefined, phases);
			diagnostics.push(...passResult.diagnostics);

			const hasPassFacts =
				passResult.nodes.length > 0 ||
				passResult.edges.length > 0 ||
				passResult.facets.length > 0;
			const passedGraph: SemanticGraph = hasPassFacts
				? {
						nodes: [...composed.graph.nodes, ...passResult.nodes],
						edges: [...composed.graph.edges, ...passResult.edges],
						facets: [...composed.graph.facets, ...passResult.facets],
					}
				: composed.graph;

				// Hand the composed+enriched graph to the provider for graph-resident
				// enrichment (dynamic derivation, selector materialization, runtime).
			const protocolSelectors = collectProtocolSelectors(collected.protocols);
				const {
					graph,
					runtime,
					diagnostics: graphDiagnostics,
				} = (await graphProvider.provide({
				graph: passedGraph,
				protocolSelectors,
				evaluator: expressionEvaluator,
			})) as {
					graph: SemanticGraph;
					runtime: GraphRuntime;
					diagnostics: Diagnostic[];
			};
			diagnostics.push(...graphDiagnostics);

			if (strict) {
				for (const node of graph.nodes) {
					if (node.kind !== "coverage.gap") continue;
					const attrs = node.attributes ?? {};
					const requestId = attrs.requestId as string | undefined;
					const capability = attrs.capability as string | null | undefined;
					const projectionKind = attrs.projectionKind as string | undefined;
					const reason = attrs.reason as string | undefined;
					diagnostics.push(
						error({
							code: "coverage.gap",
							message:
								reason === "ambiguous"
									? `Realization request '${requestId}' is ambiguous: multiple fulfillments match capability '${capability ?? "unknown"}' with projection kind '${projectionKind}'.`
									: `Realization request '${requestId}' has no fulfillment for capability '${capability ?? "unknown"}' with projection kind '${projectionKind}'.`,
							details: { ...attrs },
						}),
					);
				}
			}

			for (const protocol of registry.protocols) {
				if (!protocol.validate) continue;
				trace.push(
					traceEvent({
						stage: "protocol.validate",
						protocol: protocol.id,
					}),
				);
					diagnostics.push(
						...(await protocol.validate(graph, {
							runtime,
							documents,
						})),
					);
			}

			if (dynamicValidation) {
				diagnostics.push(
					...((await dynamicValidation.validate({
							graph,
							runtime,
							documents,
							evaluator: expressionEvaluator,
					})) as Diagnostic[]),
				);
			}

				return {
					graph,
					runtime,
					diagnostics,
					trace,
			};
		},
	};
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Protocols processed in the pre-pass using only compiled TypeScript lowering.
// Their output populates protocol.lowering.map nodes for all other protocols.
const PRE_PASS_PROTOCOLS = new Set([
	"openspec.protocol.v1",
	"openspec.graph.v1",
]);

function collectProtocolSelectors(
	protocols: readonly AnyProtocol[],
): Record<string, GraphSelector> {
	const selectors: Record<string, GraphSelector> = {};
	for (const protocol of protocols) {
		if (protocol.selectors) Object.assign(selectors, protocol.selectors);
	}
	return selectors;
}

function unknownProtocolDiagnostic(
	document: NormalizedCompileDocument,
): Diagnostic {
	return error({
		code: "protocol.unknown",
		message: `No protocol is registered for '${document.protocol}'.`,
		source: document.source,
		details: {
			documentId: document.id,
			protocol: document.protocol,
		},
	});
}

function provenanceFor(
	document: NormalizedCompileDocument,
	protocol: AnyProtocol,
	contribution: number,
): Provenance {
	return {
		protocol: protocol.id,
		documentId: document.id,
		contribution,
		...(document.source ? { source: document.source } : {}),
	};
}
