import type {
	JsonObject,
	JsonValue,
	SemanticEdge,
	SemanticEdgeId,
	SemanticFacet,
	SemanticFacetId,
	SemanticFactKind,
	SemanticNode,
	SemanticNodeId,
} from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import type { GraphDocumentLowerAdapter } from "../generated/graph-capabilities.contracts.ts";
import { implementGraphDocumentLowerAdapter } from "../generated/graph-capabilities.contracts.ts";
import type { ExpressionEvaluatorSlot } from "../slots.ts";
import {
	evalMini,
	getPath,
	type MiniContext,
	type NamedExprDef,
} from "./mini-lang.ts";

type LoweringMapSpec = {
	id: string;
	source: {
		path?: string;
		as: string;
		optional?: boolean;
	};
	facts: FactTemplate[];
};

type LoweringMapNodeAttributes = {
	id: string;
	protocol: string;
	source: LoweringMapSpec["source"];
	facts: FactTemplate[];
};

type FactTemplate =
	| NodeFact
	| EdgeFact
	| FacetFact
	| ForEachFact
	| ForEachEntryFact;

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
	indexAs?: string;
	optional?: boolean;
	facts: FactTemplate[];
};

type ForEachEntryFact = {
	kind: "forEachEntry";
	path: string;
	keyAs: string;
	valueAs: string;
	optional?: boolean;
	facts: FactTemplate[];
};

type LoweringHandle = {
	mapsByProtocol: Map<string, LoweringMapSpec[]>;
	namedExprsByProtocol: Map<string, Record<string, NamedExprDef>>;
	evaluator: ExpressionEvaluatorSlot | undefined;
};

export function createDynamicLowerer(): GraphDocumentLowerAdapter {
	return implementGraphDocumentLowerAdapter({
		async prepare({ graph, evaluator }) {
			const typedGraph = graph as { nodes: SemanticNode[] };
			const mapsByProtocol = new Map<string, LoweringMapSpec[]>();
			const namedExprsByProtocol = new Map<
				string,
				Record<string, NamedExprDef>
			>();

			for (const node of typedGraph.nodes) {
				if (node.kind === "protocol.lowering.map") {
					const attrs = node.attributes as LoweringMapNodeAttributes | null;
					if (!attrs?.protocol || !attrs.id) continue;
					const maps = mapsByProtocol.get(attrs.protocol) ?? [];
					maps.push({
						id: attrs.id,
						source: attrs.source,
						facts: attrs.facts ?? [],
					});
					mapsByProtocol.set(attrs.protocol, maps);
				} else if (node.kind === "protocol.protocol") {
					const attrs = node.attributes as {
						id?: string;
						expressions?: Record<string, { input: string; value: unknown }>;
					} | null;
					if (!attrs?.id || !attrs.expressions) continue;
					const namedExprs: Record<string, NamedExprDef> = {};
					for (const [name, def] of Object.entries(attrs.expressions)) {
						namedExprs[name] = { input: def.input, value: def.value };
					}
					namedExprsByProtocol.set(attrs.id, namedExprs);
				}
			}

			// GraphDocumentLowerHandle = unknown; cast to satisfy the contract.
			return { mapsByProtocol, namedExprsByProtocol, evaluator } as unknown;
		},

		async lower({ handle, document, protocol, documentId }) {
			const h = handle as unknown as LoweringHandle;
			const maps = h.mapsByProtocol.get(protocol as string);
			if (!maps || maps.length === 0) return null;

			const doc = document as JsonObject;
			const nodes: SemanticNode[] = [];
			const edges: SemanticEdge[] = [];
			const facets: SemanticFacet[] = [];

			const namedExprs = h.namedExprsByProtocol.get(protocol as string) ?? {};
			for (const map of maps) {
				const sourceItems = extractSourceItems(map.source, doc);
				for (const item of sourceItems) {
					const ctx: MiniContext = { document: doc, [map.source.as]: item };
					await evaluateFacts(
						map.facts,
						ctx,
						h.evaluator,
						nodes,
						edges,
						facets,
						namedExprs,
					);
				}
			}

			return {
				protocol: protocol as string,
				documentId: documentId as string,
				nodes,
				edges,
				facets,
			} satisfies SemanticContribution;
		},
	});
}

function extractSourceItems(
	source: LoweringMapSpec["source"],
	doc: JsonObject,
): unknown[] {
	if (!source.path) {
		return [doc];
	}
	const value = getPath(doc, source.path);
	if (value === null || value === undefined) {
		return [];
	}
	if (Array.isArray(value)) return value;
	return [value];
}

async function evaluateFacts(
	facts: FactTemplate[],
	ctx: MiniContext,
	evaluator: ExpressionEvaluatorSlot | undefined,
	nodes: SemanticNode[],
	edges: SemanticEdge[],
	facets: SemanticFacet[],
	namedExprs: Record<string, NamedExprDef> = {},
): Promise<void> {
	for (const fact of facts) {
		if (fact.kind === "forEach") {
			const items = extractSourceItems(
				{ path: fact.path, as: fact.as, optional: fact.optional },
				ctx as unknown as JsonObject,
			);
			for (const [index, item] of items.entries()) {
				const innerCtx: MiniContext = { ...ctx, [fact.as]: item };
				if (fact.indexAs) innerCtx[fact.indexAs] = index;
				await evaluateFacts(
					fact.facts,
					innerCtx,
					evaluator,
					nodes,
					edges,
					facets,
					namedExprs,
				);
			}
			continue;
		}

		if (fact.kind === "forEachEntry") {
			const value = getPath(ctx, fact.path);
			if (!isRecord(value)) continue;
			for (const [key, item] of Object.entries(value)) {
				const innerCtx: MiniContext = {
					...ctx,
					[fact.keyAs]: key,
					[fact.valueAs]: item,
				};
				await evaluateFacts(
					fact.facts,
					innerCtx,
					evaluator,
					nodes,
					edges,
					facets,
					namedExprs,
				);
			}
			continue;
		}

		if (fact.when !== undefined) {
			const guard = await evalExpression(fact.when, ctx, evaluator, namedExprs);
			if (!guard) continue;
		}

		const id = await evalExpression(fact.id, ctx, evaluator, namedExprs);
		if (typeof id !== "string" || !id) continue;

		const factKind = await evalExpression(
			fact.factKind,
			ctx,
			evaluator,
			namedExprs,
		);
		if (typeof factKind !== "string" || !factKind) continue;

		if (fact.kind === "node") {
			const attributes =
				fact.attributes !== undefined
					? await evalExpression(fact.attributes, ctx, evaluator, namedExprs)
					: undefined;
			nodes.push({
				id: id as SemanticNodeId,
				kind: factKind as SemanticFactKind,
				attributes:
					attributes !== undefined
						? (attributes as unknown as JsonObject)
						: undefined,
			});
		} else if (fact.kind === "edge") {
			const from = await evalExpression(fact.from, ctx, evaluator, namedExprs);
			const to = await evalExpression(fact.to, ctx, evaluator, namedExprs);
			if (typeof from !== "string" || typeof to !== "string") continue;
			const attributes =
				fact.attributes !== undefined
					? await evalExpression(fact.attributes, ctx, evaluator, namedExprs)
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
			});
		} else if (fact.kind === "facet") {
			const target = await evalExpression(
				fact.target,
				ctx,
				evaluator,
				namedExprs,
			);
			const value = await evalExpression(
				fact.value,
				ctx,
				evaluator,
				namedExprs,
			);
			if (typeof target !== "string") continue;
			facets.push({
				id: id as SemanticFacetId,
				kind: factKind as SemanticFactKind,
				target: target as SemanticNodeId,
				value: value as JsonValue,
			});
		} else {
			const unknownFact = fact as { kind?: unknown };
			throw new Error(
				`dynamic-lowerer: unknown fact kind "${String(unknownFact.kind)}". Valid kinds: node, edge, facet, forEach, forEachEntry`,
			);
		}
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function evalExpression(
	expr: unknown,
	ctx: MiniContext,
	evaluator: ExpressionEvaluatorSlot | undefined,
	namedExprs: Record<string, NamedExprDef> = {},
): Promise<unknown> {
	if (isExprEnvelope(expr)) {
		if (!evaluator) return null;
		return evaluator.evaluate({ context: ctx, expression: expr });
	}
	return evalMini(expr, ctx, namedExprs);
}

function isExprEnvelope(value: unknown): boolean {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		"$expr" in (value as object)
	);
}
