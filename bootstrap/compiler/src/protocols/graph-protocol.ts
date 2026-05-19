import type {
	JsonObject,
	SemanticEdge,
	SemanticNode,
	SemanticNodeId,
} from "@openspec/kernel";
import {
	semanticEdgeId,
	semanticFactKind,
	semanticNodeId,
} from "@openspec/kernel";
import type { SemanticContribution } from "../contribution/types.ts";
import { defineProtocol } from "../protocol/define-protocol.ts";
import type { ProtocolContext } from "../protocol/types.ts";

type LoweringMapSpec = {
	id: string;
	source: unknown;
	facts: unknown;
};

type DeriveRuleSpec = {
	id: string;
	source?: { selector?: unknown; as?: unknown; optional?: unknown };
	after?: unknown;
	facts?: unknown;
};

type ValidationSuiteSpec = {
	id: string;
	rules?: unknown;
};

type SelectorSpec = {
	id: string;
	[key: string]: unknown;
};

type ViewSpec = {
	id: string;
	owner?: string;
	[key: string]: unknown;
};

type GraphDocumentContent = {
	subject: string;
	owner?: string;
	lowering?: LoweringMapSpec[];
	derive?: DeriveRuleSpec[];
	validate?: ValidationSuiteSpec[];
	selectors?: SelectorSpec[];
	views?: ViewSpec[];
};

export const graphProtocol = defineProtocol<GraphDocumentContent>({
	id: "openspec.graph.v1",

	parse(doc) {
		if (
			!isRecord(doc) ||
			typeof (doc as GraphDocumentContent).subject !== "string"
		) {
			throw new Error(
				"openspec.graph.v1 document must have a string 'subject' field",
			);
		}
		return doc as GraphDocumentContent;
	},

	lower(doc, context: ProtocolContext): SemanticContribution {
		const subject = doc.subject;
		const owner = doc.owner ?? null;
		const nodes: SemanticNode[] = [];
		const edges: SemanticEdge[] = [];

		for (const map of doc.lowering ?? []) {
			const nid = semanticNodeId("protocol.lowering.map", subject, map.id);
			nodes.push({
				id: nid,
				kind: semanticFactKind("protocol.lowering.map"),
				attributes: {
					id: map.id,
					protocol: subject,
					source: map.source,
					facts: map.facts,
				} as unknown as JsonObject,
			});
			if (owner) {
				edges.push({
					id: semanticEdgeId(
						`graph.protocol.lowering.map.${subject}.${map.id}`,
					),
					kind: semanticFactKind("graph.protocol.lowering.map"),
					from: owner as SemanticNodeId,
					to: nid,
				});
			}
		}

		for (const rule of doc.derive ?? []) {
			nodes.push({
				id: semanticNodeId("graph.derive.rule", subject, rule.id),
				kind: semanticFactKind("graph.derive.rule"),
				attributes: {
					id: rule.id,
					subject,
					selector: rule.source?.selector ?? null,
					as: rule.source?.as ?? null,
					optional: rule.source?.optional ?? null,
					after: rule.after ?? null,
					facts: rule.facts ?? null,
				} as unknown as JsonObject,
			});
		}

		for (const suite of doc.validate ?? []) {
			const nid = semanticNodeId(
				"protocol.validation.suite",
				subject,
				suite.id,
			);
			nodes.push({
				id: nid,
				kind: semanticFactKind("protocol.validation.suite"),
				attributes: {
					id: suite.id,
					protocol: subject,
					rules: suite.rules ?? null,
				} as unknown as JsonObject,
			});
			if (owner) {
				edges.push({
					id: semanticEdgeId(`graph.validation.suite.${subject}.${suite.id}`),
					kind: semanticFactKind("graph.protocol.validation.suite"),
					from: owner as SemanticNodeId,
					to: nid,
				});
			}
		}

		for (const selector of doc.selectors ?? []) {
			const nid = semanticNodeId("selector.declaration", selector.id);
			nodes.push({
				id: nid,
				kind: semanticFactKind("selector.declaration"),
				attributes: {
					set: subject,
					definition: selector,
				} as unknown as JsonObject,
			});
			if (owner) {
				edges.push({
					id: semanticEdgeId(
						`graph.selector.declaration.${subject}.${selector.id}`,
					),
					kind: semanticFactKind("graph.selector.declaration"),
					from: owner as SemanticNodeId,
					to: nid,
				});
			}
		}

		for (const view of doc.views ?? []) {
			const nid = semanticNodeId("selector.declaration", view.id);
			nodes.push({
				id: nid,
				kind: semanticFactKind("selector.declaration"),
				attributes: {
					set: subject,
					view: true,
					owner: view.owner ?? null,
					definition: view,
				} as unknown as JsonObject,
			});
			if (owner) {
				edges.push({
					id: semanticEdgeId(`graph.view.declaration.${subject}.${view.id}`),
					kind: semanticFactKind("graph.view.declaration"),
					from: owner as SemanticNodeId,
					to: nid,
				});
			}
		}

		return {
			protocol: context.document.protocol,
			documentId: context.document.id,
			nodes,
			edges,
			facets: [],
		};
	},
});

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
