import {
	error,
	type EdgeFilter,
	type FacetFilter,
	type GraphIndexes,
	type GraphRuntime,
	type GraphSelector,
	type GraphSnapshot,
	type NeighborFilter,
	type NodeFilter,
	type SemanticEdge,
	type SemanticFacet,
	type SemanticGraph,
	type SemanticNode,
	type UseFilter,
} from "@openspec/kernel";

export function createGraphSnapshot(
	graph: SemanticGraph,
	id = graphFingerprint(graph),
): GraphSnapshot {
	return {
		id,
		graph,
		indexes: buildGraphIndexes(graph),
	};
}

export function createGraphRuntime(
	graphOrSnapshot: SemanticGraph | GraphSnapshot,
	selectors: Record<string, GraphSelector> = {},
): GraphRuntime {
	const snapshot = isGraphSnapshot(graphOrSnapshot)
		? graphOrSnapshot
		: createGraphSnapshot(graphOrSnapshot);
	const cache = new Map<string, unknown>();
	const selectorMap = new Map(Object.entries(selectors));

	const runtime: GraphRuntime = {
		graph: snapshot.graph,
		snapshot,
		selectors: selectorMap,
		node(id) {
			return snapshot.indexes.nodesById.get(String(id));
		},
		nodes(filter) {
			return filterNodes(snapshot, filter);
		},
		edge(id) {
			return snapshot.indexes.edgesById.get(String(id));
		},
		edges(filter) {
			return filterEdges(snapshot, filter);
		},
		facet(id) {
			return snapshot.indexes.facetsById.get(String(id));
		},
		facets(filter) {
			return filterFacets(snapshot, filter);
		},
		neighbors(id, filter) {
			return neighbors(snapshot, String(id), filter);
		},
		hasSelector(id) {
			return selectorMap.has(id);
		},
		select(selectorId, input) {
			const selector = selectorMap.get(selectorId);
			if (!selector) return undefined as never;
			const cacheKey = `${selectorId}\u0000${stableHash(input)}`;
			if (cache.has(cacheKey)) return cache.get(cacheKey) as never;
			const result = freezeResult(selector(input, { runtime }));
			cache.set(cacheKey, result);
			return result as never;
		},
		usersOf(nodeId, filter?: UseFilter) {
			return neighbors(snapshot, nodeId, {
				direction: "in",
				...(filter?.edgeKind ? { kind: filter.edgeKind } : {}),
			});
		},
		uses(nodeId, filter?: UseFilter) {
			return neighbors(snapshot, nodeId, {
				direction: "out",
				...(filter?.edgeKind ? { kind: filter.edgeKind } : {}),
			});
		},
		expectNode(nodeId, kind) {
			const node = snapshot.indexes.nodesById.get(nodeId);
			if (!node) {
				return {
					ok: false,
					diagnostic: error({
						code: "graph.node.notFound",
						message: `Node '${nodeId}' not found in the semantic graph.`,
						details: { nodeId, kind },
					}),
				};
			}
			if (node.kind !== kind) {
				return {
					ok: false,
					diagnostic: error({
						code: "graph.node.kindMismatch",
						message: `Node '${nodeId}' has kind '${node.kind}', expected '${kind}'.`,
						details: { nodeId, expectedKind: kind, actualKind: node.kind },
					}),
				};
			}
			return { ok: true, node };
		},
	};

	return runtime;
}

function buildGraphIndexes(graph: SemanticGraph): GraphIndexes {
	const nodesById = new Map<string, SemanticNode>();
	const nodesByKind = new Map<string, SemanticNode[]>();
	const edgesById = new Map<string, SemanticEdge>();
	const edgesByKind = new Map<string, SemanticEdge[]>();
	const edgesFrom = new Map<string, SemanticEdge[]>();
	const edgesTo = new Map<string, SemanticEdge[]>();
	const edgesByKindFrom = new Map<string, SemanticEdge[]>();
	const edgesByKindTo = new Map<string, SemanticEdge[]>();
	const facetsById = new Map<string, SemanticFacet>();
	const facetsByKind = new Map<string, SemanticFacet[]>();
	const facetsByTarget = new Map<string, SemanticFacet[]>();
	const facetsByKindTarget = new Map<string, SemanticFacet[]>();

	for (const node of graph.nodes) {
		nodesById.set(node.id, node);
		pushIndex(nodesByKind, node.kind, node);
	}
	for (const edge of graph.edges) {
		edgesById.set(edge.id, edge);
		pushIndex(edgesByKind, edge.kind, edge);
		pushIndex(edgesFrom, edge.from, edge);
		pushIndex(edgesTo, edge.to, edge);
		pushIndex(edgesByKindFrom, compositeKey(edge.kind, edge.from), edge);
		pushIndex(edgesByKindTo, compositeKey(edge.kind, edge.to), edge);
	}
	for (const facet of graph.facets) {
		facetsById.set(facet.id, facet);
		pushIndex(facetsByKind, facet.kind, facet);
		pushIndex(facetsByTarget, facet.target, facet);
		pushIndex(facetsByKindTarget, compositeKey(facet.kind, facet.target), facet);
	}

	return {
		nodesById,
		nodesByKind,
		edgesById,
		edgesByKind,
		edgesFrom,
		edgesTo,
		edgesByKindFrom,
		edgesByKindTo,
		facetsById,
		facetsByKind,
		facetsByTarget,
		facetsByKindTarget,
	};
}

function filterNodes(snapshot: GraphSnapshot, filter: NodeFilter = {}): SemanticNode[] {
	if (filter.id) {
		const node = snapshot.indexes.nodesById.get(String(filter.id));
		return node && (!filter.kind || node.kind === String(filter.kind)) ? [node] : [];
	}
	const candidates = filter.kind
		? snapshot.indexes.nodesByKind.get(String(filter.kind)) ?? []
		: snapshot.graph.nodes;
	return [...candidates];
}

function filterEdges(snapshot: GraphSnapshot, filter: EdgeFilter = {}): SemanticEdge[] {
	if (filter.id) {
		const edge = snapshot.indexes.edgesById.get(String(filter.id));
		return edge && edgeMatches(edge, filter) ? [edge] : [];
	}
	const kind = filter.kind ? String(filter.kind) : undefined;
	const from = filter.from ? String(filter.from) : undefined;
	const to = filter.to ? String(filter.to) : undefined;
	const candidates =
		kind && from
			? snapshot.indexes.edgesByKindFrom.get(compositeKey(kind, from)) ?? []
			: kind && to
				? snapshot.indexes.edgesByKindTo.get(compositeKey(kind, to)) ?? []
				: from
					? snapshot.indexes.edgesFrom.get(from) ?? []
					: to
						? snapshot.indexes.edgesTo.get(to) ?? []
						: kind
							? snapshot.indexes.edgesByKind.get(kind) ?? []
							: snapshot.graph.edges;
	return candidates.filter((edge) => edgeMatches(edge, filter));
}

function filterFacets(snapshot: GraphSnapshot, filter: FacetFilter = {}): SemanticFacet[] {
	if (filter.id) {
		const facet = snapshot.indexes.facetsById.get(String(filter.id));
		return facet && facetMatches(facet, filter) ? [facet] : [];
	}
	const kind = filter.kind ? String(filter.kind) : undefined;
	const target = filter.target ? String(filter.target) : undefined;
	const candidates =
		kind && target
			? snapshot.indexes.facetsByKindTarget.get(compositeKey(kind, target)) ?? []
			: target
				? snapshot.indexes.facetsByTarget.get(target) ?? []
				: kind
					? snapshot.indexes.facetsByKind.get(kind) ?? []
					: snapshot.graph.facets;
	return candidates.filter((facet) => facetMatches(facet, filter));
}

function neighbors(
	snapshot: GraphSnapshot,
	nodeId: string,
	filter: NeighborFilter = {},
): SemanticNode[] {
	const direction = filter.direction ?? "both";
	const edgeKind = filter.kind ? String(filter.kind) : undefined;
	const edges: SemanticEdge[] = [];
	if (direction === "out" || direction === "both") {
		edges.push(
			...(edgeKind
				? snapshot.indexes.edgesByKindFrom.get(compositeKey(edgeKind, nodeId)) ?? []
				: snapshot.indexes.edgesFrom.get(nodeId) ?? []),
		);
	}
	if (direction === "in" || direction === "both") {
		edges.push(
			...(edgeKind
				? snapshot.indexes.edgesByKindTo.get(compositeKey(edgeKind, nodeId)) ?? []
				: snapshot.indexes.edgesTo.get(nodeId) ?? []),
		);
	}
	const found = new Map<string, SemanticNode>();
	for (const edge of edges) {
		const otherId = edge.from === nodeId ? edge.to : edge.from;
		const node = snapshot.indexes.nodesById.get(otherId);
		if (node) found.set(node.id, node);
	}
	return [...found.values()];
}

function edgeMatches(edge: SemanticEdge, filter: EdgeFilter): boolean {
	return (
		(!filter.kind || edge.kind === String(filter.kind)) &&
		(!filter.from || edge.from === String(filter.from)) &&
		(!filter.to || edge.to === String(filter.to))
	);
}

function facetMatches(facet: SemanticFacet, filter: FacetFilter): boolean {
	return (
		(!filter.kind || facet.kind === String(filter.kind)) &&
		(!filter.target || facet.target === String(filter.target))
	);
}

function pushIndex<T>(index: Map<string, T[]>, key: string, value: T): void {
	const values = index.get(key);
	if (values) values.push(value);
	else index.set(key, [value]);
}

function compositeKey(left: string, right: string): string {
	return `${left}\u0000${right}`;
}

function isGraphSnapshot(value: SemanticGraph | GraphSnapshot): value is GraphSnapshot {
	return "indexes" in value && "graph" in value && "id" in value;
}

function graphFingerprint(graph: SemanticGraph): string {
	return stableHash({
		nodes: graph.nodes.map((node) => [node.id, node.kind]),
		edges: graph.edges.map((edge) => [edge.id, edge.kind, edge.from, edge.to]),
		facets: graph.facets.map((facet) => [facet.id, facet.kind, facet.target]),
	});
}

function stableHash(value: unknown): string {
	return JSON.stringify(normalizeForHash(value));
}

function normalizeForHash(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeForHash);
	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return Object.fromEntries(
			Object.keys(record)
				.sort()
				.map((key) => [key, normalizeForHash(record[key])]),
		);
	}
	if (typeof value === "function" || typeof value === "symbol") return String(value);
	return value;
}

function freezeResult<T>(value: T): T {
	if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
	for (const nested of Object.values(value as Record<string, unknown>)) {
		freezeResult(nested);
	}
	return Object.freeze(value);
}
