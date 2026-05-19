import type {
	Diagnostic,
	JsonObject,
	JsonValue,
	Provenance,
	SemanticEdge,
	SemanticEdgeId,
	SemanticFacet,
	SemanticFacetId,
	SemanticFactKind,
	SemanticGraph,
	SemanticNode,
	SemanticNodeId,
	GraphRuntime,
	GraphSelector,
} from "@openspec/kernel";
import { error } from "@openspec/kernel";
import type { NormalizedSemanticContribution } from "../contribution/types.ts";
import type { DynamicDerivationResult } from "../generated/compiler.types.ts";
import type { GraphDeriveAdapter } from "../generated/graph-capabilities.contracts.ts";
import { implementGraphDeriveAdapter } from "../generated/graph-capabilities.contracts.ts";
import { evalMini, getPath, type MiniContext } from "../lowering/mini-lang.ts";
import { createGraphSelectorMaterializer } from "../selectors/graph-selector-materializer.ts";
import type { ExpressionEvaluatorSlot } from "../slots.ts";
import { composeGraph } from "./compose.ts";
import { createGraphRuntime } from "./runtime.ts";

type DeriveRuleAttributes = {
	id?: string;
	selector?: string | null;
	as?: string | null;
	optional?: boolean | null;
	after?: unknown;
	facts?: FactTemplate[] | null;
};

type DeriveRule = {
	node: SemanticNode;
	id: string;
	selector: string;
	as: string;
	optional: boolean;
	after: string[];
	facts: FactTemplate[];
};

type FactTemplate = NodeFact | EdgeFact | FacetFact | ForEachFact;

type NodeFact = {
	kind: "node";
	when?: unknown;
	id: unknown;
	factKind: unknown;
	attributes?: unknown;
};

type EdgeFact = {
	kind: "edge";
	when?: unknown;
	id: unknown;
	factKind: unknown;
	from: unknown;
	to: unknown;
	attributes?: unknown;
};

type FacetFact = {
	kind: "facet";
	when?: unknown;
	id: unknown;
	factKind: unknown;
	target: unknown;
	value: unknown;
};

type ForEachFact = {
	kind: "forEach";
	path: string;
	as: string;
	optional?: boolean;
	facts: FactTemplate[];
};

export function createDynamicDeriver(): GraphDeriveAdapter {
	return implementGraphDeriveAdapter({
		async derive({ graph, runtime, evaluator }) {
			const typedGraph = graph as SemanticGraph;
			const typedRuntime = runtime as GraphRuntime;
			const typedEvaluator = evaluator as ExpressionEvaluatorSlot | undefined;
			const nodes: SemanticNode[] = [];
			const edges: SemanticEdge[] = [];
			const facets: SemanticFacet[] = [];
			const diagnostics: Diagnostic[] = [];
			const rules = collectRules(typedGraph);
			const sorted = sortRules(rules);
			if (sorted.diagnostics.length > 0)
				diagnostics.push(...sorted.diagnostics);
			if (sorted.phases.length === 0) {
				return {
					nodes,
					edges,
					facets,
					diagnostics,
				} satisfies DynamicDerivationResult;
			}

			let currentGraph = typedGraph;
			const baseContribution: NormalizedSemanticContribution = {
				protocol: "graph.dynamic.base",
				documentId: "graph.dynamic.base",
				nodes: typedGraph.nodes,
				edges: typedGraph.edges,
				facets: typedGraph.facets,
				diagnostics: [],
			};
			const derivedContributions: NormalizedSemanticContribution[] = [];

			for (const phase of sorted.phases) {
				const phaseNodes: SemanticNode[] = [];
				const phaseEdges: SemanticEdge[] = [];
				const phaseFacets: SemanticFacet[] = [];
				const phaseRuntime = await createPhaseRuntime(currentGraph, typedRuntime);

				for (const rule of phase) {
					const provenance = provenanceForRule(rule);
					if (!phaseRuntime.hasSelector(rule.selector)) {
						if (!rule.optional) {
							diagnostics.push(
								error({
									code: "derivation.rule.selector.missing",
									message: `Derivation rule '${rule.id}' references missing selector '${rule.selector}'.`,
									details: {
										rule: rule.id,
										selector: rule.selector,
										nodeId: rule.node.id,
									},
								}),
							);
						}
						continue;
					}
					const selected = phaseRuntime.select(rule.selector, {});
					const rows = Array.isArray(selected)
						? selected
						: selected == null
							? []
							: [selected];
					for (const row of rows) {
						const ctx: MiniContext = { [rule.as]: row };
						const factProvenance = mergeProvenance([
							...provenance,
							...provenanceFromValue(row),
						]);
						await evaluateFacts(
							rule.facts,
							ctx,
							typedEvaluator,
							phaseNodes,
							phaseEdges,
							phaseFacets,
							factProvenance,
						);
					}
				}

				if (
					phaseNodes.length === 0 &&
					phaseEdges.length === 0 &&
					phaseFacets.length === 0
				) {
					continue;
				}

				nodes.push(...phaseNodes);
				edges.push(...phaseEdges);
				facets.push(...phaseFacets);
				derivedContributions.push({
					protocol: "graph.dynamic.derivation",
					documentId: `graph.dynamic.derivation.${derivedContributions.length}`,
					nodes: phaseNodes,
					edges: phaseEdges,
					facets: phaseFacets,
					diagnostics: [],
				});
				currentGraph = composeGraph([
					baseContribution,
					...derivedContributions,
				]).graph;
			}

			return {
				nodes,
				edges,
				facets,
				diagnostics,
			} satisfies DynamicDerivationResult;
		},
	});
}

function collectRules(graph: SemanticGraph): DeriveRule[] {
	const rules: DeriveRule[] = [];
	for (const node of graph.nodes) {
		if (node.kind !== "graph.derive.rule") continue;
		const attrs = node.attributes as DeriveRuleAttributes | undefined;
		if (!attrs?.id || !attrs.selector || !Array.isArray(attrs.facts)) continue;
		rules.push({
			node,
			id: attrs.id,
			selector: attrs.selector,
			as: attrs.as ?? "item",
			optional: attrs.optional ?? false,
			after: Array.isArray(attrs.after)
				? attrs.after.filter((id): id is string => typeof id === "string")
				: [],
			facts: attrs.facts,
		});
	}
	return rules;
}

function sortRules(rules: DeriveRule[]): {
	phases: DeriveRule[][];
	diagnostics: Diagnostic[];
} {
	const diagnostics: Diagnostic[] = [];
	const byId = new Map<string, DeriveRule>();
	for (const rule of rules) {
		if (!byId.has(rule.id)) byId.set(rule.id, rule);
	}

	const remaining = new Map<string, Set<string>>();
	const runnable = new Map<string, DeriveRule>();
	for (const rule of rules) {
		const missing = rule.after.filter((dependency) => !byId.has(dependency));
		if (missing.length > 0) {
			for (const dependency of missing) {
				diagnostics.push(
					error({
						code: "derivation.rule.after.unknown",
						message: `Derivation rule '${rule.id}' depends on unknown rule '${dependency}'.`,
						details: {
							rule: rule.id,
							dependency,
							nodeId: rule.node.id,
						},
					}),
				);
			}
			continue;
		}
		runnable.set(rule.id, rule);
		remaining.set(rule.id, new Set(rule.after));
	}

	const phases: DeriveRule[][] = [];
	const completed = new Set<string>();
	while (remaining.size > 0) {
		const readyIds = [...remaining.entries()]
			.filter(([, dependencies]) =>
				[...dependencies].every((dependency) => completed.has(dependency)),
			)
			.map(([id]) => id)
			.sort();
		if (readyIds.length === 0) {
			const cycle = [...remaining.keys()].sort();
			diagnostics.push(
				error({
					code: "derivation.rule.after.cycle",
					message: `Derivation rules form a dependency cycle: ${cycle.join(", ")}.`,
					details: { rules: cycle },
				}),
			);
			break;
		}

		const phase = readyIds.flatMap((id) => {
			const rule = runnable.get(id);
			return rule ? [rule] : [];
		});
		phases.push(phase);
		for (const id of readyIds) {
			remaining.delete(id);
			completed.add(id);
		}
	}

	return { phases, diagnostics };
}

async function createPhaseRuntime(
	graph: SemanticGraph,
	baseRuntime: GraphRuntime,
): Promise<GraphRuntime> {
	const materializer = createGraphSelectorMaterializer();
	const materialized =
		((await materializer.materialize({ graph })) as Record<
			string,
			GraphSelector
		>) ?? {};
	const selectors = {
		...Object.fromEntries(baseRuntime.selectors),
		...materialized,
	};
	return createGraphRuntime(graph, selectors);
}

async function evaluateFacts(
	facts: FactTemplate[],
	ctx: MiniContext,
	evaluator: ExpressionEvaluatorSlot | undefined,
	nodes: SemanticNode[],
	edges: SemanticEdge[],
	facets: SemanticFacet[],
	provenance: Provenance[],
): Promise<void> {
	for (const fact of facts) {
		if (fact.kind === "forEach") {
			const items = extractSourceItems(fact, ctx);
			for (const item of items) {
				await evaluateFacts(
					fact.facts,
					{ ...ctx, [fact.as]: item },
					evaluator,
					nodes,
					edges,
					facets,
					provenance,
				);
			}
			continue;
		}

		if (fact.when !== undefined) {
			const guard = await evalExpression(fact.when, ctx, evaluator);
			if (!guard) continue;
		}

		const id = await evalExpression(fact.id, ctx, evaluator);
		const factKind = await evalExpression(fact.factKind, ctx, evaluator);
		if (typeof id !== "string" || !id) continue;
		if (typeof factKind !== "string" || !factKind) continue;

		if (fact.kind === "node") {
			const attributes =
				fact.attributes !== undefined
					? await evalExpression(fact.attributes, ctx, evaluator)
					: undefined;
			nodes.push({
				id: id as SemanticNodeId,
				kind: factKind as SemanticFactKind,
				attributes:
					attributes !== undefined
						? (attributes as unknown as JsonObject)
						: undefined,
				provenance,
			});
			continue;
		}

		if (fact.kind === "edge") {
			const from = await evalExpression(fact.from, ctx, evaluator);
			const to = await evalExpression(fact.to, ctx, evaluator);
			if (typeof from !== "string" || typeof to !== "string") continue;
			const attributes =
				fact.attributes !== undefined
					? await evalExpression(fact.attributes, ctx, evaluator)
					: undefined;
			edges.push({
				id: id as SemanticEdgeId,
				kind: factKind as SemanticFactKind,
				from: from as SemanticNodeId,
				to: to as SemanticNodeId,
				attributes:
					attributes !== undefined
						? (attributes as unknown as JsonObject)
						: undefined,
				provenance,
			});
			continue;
		}

		if (fact.kind === "facet") {
			const target = await evalExpression(fact.target, ctx, evaluator);
			const value = await evalExpression(fact.value, ctx, evaluator);
			if (typeof target !== "string") continue;
			facets.push({
				id: id as SemanticFacetId,
				kind: factKind as SemanticFactKind,
				target: target as SemanticNodeId,
				value: value as JsonValue,
				provenance,
			});
		}
	}
}

function provenanceForRule(rule: DeriveRule): Provenance[] {
	if (rule.node.provenance?.length) return [...rule.node.provenance];
	return [
		{
			protocol: "graph.dynamic.derivation",
			documentId: String(rule.node.id),
			contribution: 0,
		},
	];
}

function provenanceFromValue(value: unknown, seen = new WeakSet<object>()): Provenance[] {
	if (value === null || value === undefined || typeof value !== "object") return [];
	if (seen.has(value)) return [];
	seen.add(value);
	const record = value as Record<string, unknown>;
	const result: Provenance[] = [];
	if (Array.isArray(record.provenance)) {
		result.push(...record.provenance.filter(isProvenance));
	}
	for (const item of Object.values(record)) {
		result.push(...provenanceFromValue(item, seen));
	}
	return result;
}

function mergeProvenance(items: Provenance[]): Provenance[] {
	const seen = new Set<string>();
	const result: Provenance[] = [];
	for (const item of items) {
		const key = JSON.stringify(item);
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(item);
	}
	return result;
}

function isProvenance(value: unknown): value is Provenance {
	if (value === null || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.protocol === "string" &&
		typeof record.documentId === "string" &&
		typeof record.contribution === "number"
	);
}

function extractSourceItems(
	source: { path?: string; optional?: boolean },
	ctx: MiniContext,
): unknown[] {
	if (!source.path) return [ctx];
	const value = getPath(ctx, source.path);
	if (value === null || value === undefined) return [];
	return Array.isArray(value) ? value : [value];
}

async function evalExpression(
	expr: unknown,
	ctx: MiniContext,
	evaluator: ExpressionEvaluatorSlot | undefined,
): Promise<unknown> {
	if (isExprEnvelope(expr)) {
		if (!evaluator) return null;
		return evaluator.evaluate({ context: ctx, expression: expr });
	}
	return evalMini(expr, ctx);
}

function isExprEnvelope(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"$expr" in (value as object)
	);
}
