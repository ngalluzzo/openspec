import type { Diagnostic } from "../diagnostics/types.ts";
import type {
	SemanticEdgeId,
	SemanticFacetId,
	SemanticFactKind,
	SemanticNodeId,
} from "./ids.ts";
import type {
	SemanticEdge,
	SemanticFacet,
	SemanticGraph,
	SemanticNode,
} from "./types.ts";

export type NodeFilter = {
	id?: string | SemanticNodeId;
	kind?: string | SemanticFactKind;
};

export type EdgeFilter = {
	id?: string | SemanticEdgeId;
	kind?: string | SemanticFactKind;
	from?: string | SemanticNodeId;
	to?: string | SemanticNodeId;
};

export type FacetFilter = {
	id?: string | SemanticFacetId;
	kind?: string | SemanticFactKind;
	target?: string | SemanticNodeId;
};

export type NeighborFilter = {
	kind?: string | SemanticFactKind;
	direction?: "out" | "in" | "both";
};

export type NodeLookupResult =
	| {
			ok: true;
			node: SemanticNode;
	  }
	| {
			ok: false;
			diagnostic: Diagnostic;
	  };

export type SemanticGraphQuery = {
	edge(id: string): SemanticEdge | undefined;
	edges(filter?: EdgeFilter): SemanticEdge[];
	facet(id: string): SemanticFacet | undefined;
	facets(filter?: FacetFilter): SemanticFacet[];
	neighbors(id: string, filter?: NeighborFilter): SemanticNode[];
	node(id: string): SemanticNode | undefined;
	nodes(filter?: NodeFilter): SemanticNode[];
};

export type UseFilter = {
	edgeKind?: string;
};

export type GraphIndexes = {
	nodesById: ReadonlyMap<string, SemanticNode>;
	nodesByKind: ReadonlyMap<string, readonly SemanticNode[]>;
	edgesById: ReadonlyMap<string, SemanticEdge>;
	edgesByKind: ReadonlyMap<string, readonly SemanticEdge[]>;
	edgesFrom: ReadonlyMap<string, readonly SemanticEdge[]>;
	edgesTo: ReadonlyMap<string, readonly SemanticEdge[]>;
	edgesByKindFrom: ReadonlyMap<string, readonly SemanticEdge[]>;
	edgesByKindTo: ReadonlyMap<string, readonly SemanticEdge[]>;
	facetsById: ReadonlyMap<string, SemanticFacet>;
	facetsByKind: ReadonlyMap<string, readonly SemanticFacet[]>;
	facetsByTarget: ReadonlyMap<string, readonly SemanticFacet[]>;
	facetsByKindTarget: ReadonlyMap<string, readonly SemanticFacet[]>;
};

export type GraphSnapshot = {
	id: string;
	graph: SemanticGraph;
	indexes: GraphIndexes;
};

export type GraphRuntime = SemanticGraphQuery & {
	graph: SemanticGraph;
	snapshot: GraphSnapshot;
	selectors: ReadonlyMap<string, GraphSelector>;
	hasSelector(id: string): boolean;
	select<TResult = unknown, TInput = unknown>(selector: string, input: TInput): TResult;
	expectNode(nodeId: string, kind: string): NodeLookupResult;
	/** All nodes that reference this node via an incoming edge. */
	usersOf(nodeId: string, filter?: UseFilter): SemanticNode[];
	/** All nodes that this node references via an outgoing edge. */
	uses(nodeId: string, filter?: UseFilter): SemanticNode[];
};

export type GraphSelectorContext = {
	runtime: GraphRuntime;
};

export type GraphSelector<TResult = unknown, TInput = unknown> = {
	select(input: TInput, context: GraphSelectorContext): TResult;
}["select"];
