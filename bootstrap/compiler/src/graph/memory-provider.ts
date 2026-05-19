import type {
	Diagnostic,
	JsonObject,
	SemanticEdge,
	SemanticFacet,
	SemanticGraph,
	SemanticNode,
	GraphRuntime,
	GraphSelector,
} from "@openspec/kernel";
import { error } from "@openspec/kernel";
import type {
	DynamicDerivationResult,
	MemoryGraphProviderOptions as GeneratedMemoryGraphProviderOptions,
	GraphProviderResult,
} from "../generated/compiler.types.ts";
import type {
	GraphDeriveAdapter as GraphDerive,
	GraphProvideAdapter as GraphProvide,
	GraphSelectorsMaterializeAdapter as GraphSelectorsMaterialize,
} from "../generated/graph-capabilities.contracts.ts";
import { implementGraphProvideAdapter } from "../generated/graph-capabilities.contracts.ts";
import { createGraphSelectorMaterializer } from "../selectors/graph-selector-materializer.ts";
import type { ExpressionEvaluatorSlot } from "../slots.ts";
import { composeGraph } from "./compose.ts";
import { createDynamicDeriver } from "./dynamic-deriver.ts";
import { createGraphRuntime } from "./runtime.ts";

// GraphTraverserSlot is a factory — takes a graph and returns a runtime.
// Not a method-based capability; kept as a typed function alias.
export type GraphTraverserSlot = (
	graph: SemanticGraph,
	selectors?: Record<string, GraphSelector>,
) => GraphRuntime;

export type GraphEnrichmentResult = {
	nodes: SemanticNode[];
	edges: SemanticEdge[];
	facets: SemanticFacet[];
	diagnostics?: Diagnostic[];
};

export type GraphEnricher = (
	graph: SemanticGraph,
) => GraphEnrichmentResult | Promise<GraphEnrichmentResult>;

// MemoryGraphProviderOptions applies strong types over the generated base.
export type MemoryGraphProviderOptions = Omit<
	GeneratedMemoryGraphProviderOptions,
	"dynamicDerivation" | "graphSelectorMaterializer" | "graphTraverser"
> & {
	dynamicDerivation?: GraphDerive;
	graphSelectorMaterializer?: GraphSelectorsMaterialize;
	graphTraverser?: GraphTraverserSlot;
	graphEnrichers?: GraphEnricher[];
};

// ── Default in-memory implementation ─────────────────────────────────────────

export function createMemoryGraphProvider(
	options: MemoryGraphProviderOptions = {},
): GraphProvide {
	const traverse = options.graphTraverser ?? createGraphRuntime;
	const dynamicDerivation = options.dynamicDerivation ?? createDynamicDeriver();
	const selectorMaterializer =
		options.graphSelectorMaterializer ?? createGraphSelectorMaterializer();
	const graphEnrichers = options.graphEnrichers ?? [];

	return implementGraphProvideAdapter({
		async provide({ graph, protocolSelectors, evaluator }) {
			const typedGraph = graph as SemanticGraph;
			const typedSelectors = protocolSelectors as Record<
				string,
				GraphSelector
			>;
			const typedEvaluator = evaluator as ExpressionEvaluatorSlot | undefined;
			const diagnostics: unknown[] = [];

				// Build an intermediate runtime so dynamic derivation can query the graph.
			const intermediateRegistry = await buildSelectorRegistry(
				typedGraph,
				typedSelectors,
				selectorMaterializer,
			);
				const intermediateRuntime = traverse(typedGraph, intermediateRegistry);

			// Graph-resident derivation rules (declared via graph.derive.rule nodes).
			const dynResult = dynamicDerivation
				? ((await dynamicDerivation.derive({
						graph: typedGraph,
							runtime: intermediateRuntime,
						evaluator: typedEvaluator,
					})) as DynamicDerivationResult)
				: null;
			diagnostics.push(...(dynResult?.diagnostics ?? []));

			const hasDynFacts =
				dynResult &&
				(dynResult.nodes.length > 0 ||
					dynResult.edges.length > 0 ||
					dynResult.facets.length > 0);
			const derivedFacts = dynResult
				? {
						nodes: dynResult.nodes as SemanticNode[],
						edges: dynResult.edges as SemanticEdge[],
						facets: dynResult.facets as SemanticFacet[],
					}
				: null;

			const finalComposition = hasDynFacts
				? composeGraph([
						{
							protocol: "graph.provider.base",
							documentId: "graph.provider.base",
							nodes: typedGraph.nodes,
							edges: typedGraph.edges,
							facets: typedGraph.facets,
							diagnostics: [],
						},
						{
							protocol: "graph.dynamic.derivation",
							documentId: "graph.dynamic.derivation",
							nodes: derivedFacts?.nodes ?? [],
							edges: derivedFacts?.edges ?? [],
							facets: derivedFacts?.facets ?? [],
							diagnostics: [],
						},
					])
				: null;
			if (finalComposition && derivedFacts) {
				diagnostics.push(
					...diagnosticsForDerivedFacts(
						finalComposition.diagnostics,
						derivedFacts,
					),
				);
			}

			let enrichedGraph: SemanticGraph = finalComposition?.graph ?? typedGraph;
			let hasEnrichmentFacts = false;
			for (const [index, enricher] of graphEnrichers.entries()) {
				const enrichment = await enricher(enrichedGraph);
				diagnostics.push(...(enrichment.diagnostics ?? []));
				const hasFacts =
					enrichment.nodes.length > 0 ||
					enrichment.edges.length > 0 ||
					enrichment.facets.length > 0;
				if (!hasFacts) continue;
				hasEnrichmentFacts = true;
				const enrichmentComposition = composeGraph([
					{
						protocol: "graph.provider.base",
						documentId: `graph.provider.enrichment.base.${index}`,
						nodes: enrichedGraph.nodes,
						edges: enrichedGraph.edges,
						facets: enrichedGraph.facets,
						diagnostics: [],
					},
					{
						protocol: "graph.provider.enrichment",
						documentId: `graph.provider.enrichment.${index}`,
						nodes: enrichment.nodes,
						edges: enrichment.edges,
						facets: enrichment.facets,
						diagnostics: [],
					},
				]);
				diagnostics.push(
					...diagnosticsForDerivedFacts(enrichmentComposition.diagnostics, {
						nodes: enrichment.nodes,
						edges: enrichment.edges,
						facets: enrichment.facets,
					}),
				);
				enrichedGraph = enrichmentComposition.graph;
			}

			const finalGraph: SemanticGraph = enrichedGraph;

			const finalRegistry = hasDynFacts || hasEnrichmentFacts
				? await buildSelectorRegistry(
						finalGraph,
						typedSelectors,
						selectorMaterializer,
					)
				: intermediateRegistry;
				const runtime = hasDynFacts || hasEnrichmentFacts
					? traverse(finalGraph, finalRegistry)
					: intermediateRuntime;
				diagnostics.push(
					...(await runGraphValidationSuites(
						finalGraph,
						runtime,
						typedEvaluator,
					)),
				);

				return {
					graph: finalGraph,
					runtime,
					diagnostics,
				} satisfies GraphProviderResult;
		},
	});
}

type GraphValidationRule = {
	id?: string;
	selector?: string;
	forEach?: boolean;
	assert?: unknown;
	code?: string;
	message?: string;
	details?: unknown;
};

async function runGraphValidationSuites(
	graph: SemanticGraph,
	runtime: GraphRuntime,
	evaluator: ExpressionEvaluatorSlot | undefined,
): Promise<Diagnostic[]> {
	if (!evaluator) return [];
	const diagnostics: Diagnostic[] = [];
	for (const suite of graph.nodes) {
		if (suite.kind !== "protocol.validation.suite") continue;
		const rules = (suite.attributes as { rules?: unknown } | undefined)?.rules;
		if (!Array.isArray(rules)) continue;
		for (const rule of rules as GraphValidationRule[]) {
			if (!rule.selector || rule.assert === undefined) continue;
				if (!runtime.hasSelector(rule.selector)) continue;
				const result = runtime.select(rule.selector, {});
			const items = rule.forEach
				? Array.isArray(result)
					? result
					: result === null || result === undefined
						? []
						: [result]
				: [result];
			for (const item of items) {
				const context = { result, item };
				const ok = await evaluator.evaluate({
					context,
					expression: rule.assert,
				});
				if (ok) continue;
				const details = rule.details
					? await evaluator.evaluate({
							context,
							expression: rule.details,
						})
					: undefined;
				diagnostics.push(
					error({
						code: rule.code ?? "graph.validation.failed",
						message: rule.message ?? `Graph validation rule '${rule.id ?? "unknown"}' failed.`,
						...(isJsonObject(details) ? { details } : {}),
					}),
				);
			}
		}
	}
	return diagnostics;
}

function diagnosticsForDerivedFacts(
	diagnostics: readonly Diagnostic[],
	derived: {
		nodes: readonly SemanticNode[];
		edges: readonly SemanticEdge[];
		facets: readonly SemanticFacet[];
	},
): Diagnostic[] {
	const nodeIds = new Set(derived.nodes.map((node) => String(node.id)));
	const edgeIds = new Set(derived.edges.map((edge) => String(edge.id)));
	const facetIds = new Set(derived.facets.map((facet) => String(facet.id)));
	return diagnostics.filter((diagnostic) => {
		const details = diagnostic.details ?? {};
		return (
			nodeIds.has(String(details.id)) ||
			nodeIds.has(String(details.node)) ||
			edgeIds.has(String(details.id)) ||
			edgeIds.has(String(details.edge)) ||
			facetIds.has(String(details.id)) ||
			facetIds.has(String(details.facet))
		);
	});
}

async function buildSelectorRegistry(
	graph: SemanticGraph,
	protocolSelectors: Record<string, GraphSelector>,
	materializer?: GraphSelectorsMaterialize,
): Promise<Record<string, GraphSelector>> {
	const registry = { ...protocolSelectors };
	const materialized = await materializer?.materialize({ graph });
	if (materialized)
		Object.assign(registry, materialized as Record<string, GraphSelector>);
	return registry;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
