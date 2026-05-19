import {
	type DerivationPass,
	type Diagnostic,
	error,
	type SemanticEdge,
	type SemanticFacet,
	type SemanticGraph,
	type SemanticNode,
	type GraphRuntime,
	type GraphSelector,
} from "@openspec/kernel";
import type { NormalizedSemanticContribution } from "../contribution/types.ts";
import { composeGraph } from "../graph/compose.ts";
import { createGraphRuntime } from "../graph/runtime.ts";

type GraphTraverser = (
	graph: SemanticGraph,
	selectors?: Record<string, GraphSelector>,
) => GraphRuntime;

export type PassManagerResult = {
	nodes: SemanticNode[];
	edges: SemanticEdge[];
	facets: SemanticFacet[];
	diagnostics: Diagnostic[];
};

export async function runPasses(
	passes: readonly DerivationPass[],
	baseContributions: readonly NormalizedSemanticContribution[],
	graphTraverser?: GraphTraverser,
	phases?: readonly string[],
): Promise<PassManagerResult> {
	const resolveGraphRuntime = graphTraverser ?? createGraphRuntime;

	const allNodes: SemanticNode[] = [];
	const allEdges: SemanticEdge[] = [];
	const allFacets: SemanticFacet[] = [];
	const allDiagnostics: Diagnostic[] = [];

	let contributions: NormalizedSemanticContribution[] = [...baseContributions];

	for (const group of groupByPhase(passes, phases ?? [])) {
		const sorted = topoSort(group);
		if ("diagnostics" in sorted) {
			return {
				nodes: allNodes,
				edges: allEdges,
				facets: allFacets,
				diagnostics: [...allDiagnostics, ...sorted.diagnostics],
			};
		}

		for (const pass of sorted.passes) {
			const composed = composeGraph(contributions);
			allDiagnostics.push(...composed.diagnostics);
			const runtime = resolveGraphRuntime(composed.graph);

			const result = await pass.derive({ runtime });

			const passNodes = [...(result.nodes ?? [])];
			const passEdges = [...(result.edges ?? [])];
			const passFacets = [...(result.facets ?? [])];

			allNodes.push(...passNodes);
			allEdges.push(...passEdges);
			allFacets.push(...passFacets);
			allDiagnostics.push(...(result.diagnostics ?? []));

			if (
				passNodes.length > 0 ||
				passEdges.length > 0 ||
				passFacets.length > 0
			) {
				contributions = [
					...contributions,
					{
						protocol: pass.id,
						documentId: pass.id,
						nodes: passNodes,
						edges: passEdges,
						facets: passFacets,
						diagnostics: [],
					},
				];
			}
		}
	}

	return {
		nodes: allNodes,
		edges: allEdges,
		facets: allFacets,
		diagnostics: allDiagnostics,
	};
}

// Groups passes by phase in the order defined by the phases array. Passes
// without a phase go into "default", which runs after all named phases.
// Unknown phase names (not in the phases array) are appended in encounter order.
function groupByPhase(
	passes: readonly DerivationPass[],
	phases: readonly string[],
): DerivationPass[][] {
	if (passes.length === 0) return [];

	const phaseOrder: string[] = [...phases];
	if (!phaseOrder.includes("default")) phaseOrder.push("default");

	const groups = new Map<string, DerivationPass[]>(
		phaseOrder.map((phase) => [phase, []]),
	);

	for (const pass of passes) {
		const phase = pass.phase ?? "default";
		if (!groups.has(phase)) {
			groups.set(phase, []);
			phaseOrder.push(phase);
		}
		groups.get(phase)?.push(pass);
	}

	return phaseOrder
		.map((phase) => groups.get(phase))
		.filter((group): group is DerivationPass[] => (group?.length ?? 0) > 0);
}

function topoSort(
	passes: readonly DerivationPass[],
): { passes: DerivationPass[] } | { diagnostics: Diagnostic[] } {
	if (passes.length === 0) return { passes: [] };

	const byId = new Map(passes.map((p) => [p.id, p]));
	const deps = new Map<string, Set<string>>();

	for (const pass of passes) {
		const before = new Set<string>();
		for (const read of pass.reads) {
			for (const other of passes) {
				if (other.id !== pass.id && other.writes.includes(read)) {
					before.add(other.id);
				}
			}
		}
		deps.set(pass.id, before);
	}

	// Kahn's algorithm
	const inDegree = new Map(
		passes.map((p) => [p.id, deps.get(p.id)?.size ?? 0]),
	);
	const queue = passes
		.filter((p) => (inDegree.get(p.id) ?? 0) === 0)
		.map((p) => p.id);
	const sorted: DerivationPass[] = [];

	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) {
			continue;
		}
		const pass = byId.get(id);
		if (pass) sorted.push(pass);
		for (const other of passes) {
			const otherDeps = deps.get(other.id);
			if (!otherDeps?.has(id)) continue;
			otherDeps.delete(id);
			if (otherDeps.size === 0) queue.push(other.id);
		}
	}

	if (sorted.length !== passes.length) {
		const cycle = passes
			.filter((p) => !sorted.includes(p))
			.map((p) => p.id)
			.join(", ");
		return {
			diagnostics: [
				error({
					code: "derivation.passes.cycle",
					message: `Derivation passes form a dependency cycle: ${cycle}`,
					details: { passes: cycle },
				}),
			],
		};
	}

	return { passes: sorted };
}
