import type { Diagnostic } from "@openspec/kernel";
import { error } from "@openspec/kernel";
import type { CompileDocumentInput } from "../document/types.ts";
import { evalMini, type MiniContext } from "../lowering/mini-lang.ts";

const PATTERN_PROTOCOL = "openspec.pattern.v1";

type PatternDeclaration = {
	id: string;
	owner: string;
	input?: { model?: string };
	expands: {
		documents: PatternExpandDoc[];
	};
};

type PatternExpandDoc = {
	id: unknown;
	protocol: unknown;
	document: unknown;
	metadata?: unknown;
};

type PatternApplication = {
	id: string;
	pattern: string;
	inputs?: Record<string, unknown>;
	_sourceDocumentId?: string;
};

type PatternDocumentContent = {
	patterns?: PatternDeclaration[];
	applications?: PatternApplication[];
};

export type ExpandPatternsResult = {
	expanded: CompileDocumentInput[];
	diagnostics: Diagnostic[];
};

export async function expandPatterns(
	documents: readonly CompileDocumentInput[],
): Promise<ExpandPatternsResult> {
	const patternDocs = documents.filter((d) => d.protocol === PATTERN_PROTOCOL);
	if (patternDocs.length === 0) return { expanded: [], diagnostics: [] };

	const declarations = new Map<string, PatternDeclaration>();
	collectDeclarations(patternDocs, declarations);

	const expanded: CompileDocumentInput[] = [];
	const diagnostics: Diagnostic[] = [];
	let applications = collectApplications(patternDocs);
	let depth = 0;

	while (applications.length > 0) {
		if (depth > 20) {
			diagnostics.push(
				error({
					code: "pattern.expansion.depth",
					message: "Pattern expansion exceeded maximum recursion depth (20).",
				}),
			);
			break;
		}

		const currentApplications = applications;
		applications = [];

		for (const application of currentApplications) {
			const decl = declarations.get(application.pattern);
			if (!decl) {
				diagnostics.push(
					error({
						code: "pattern.application.unresolved",
						message: `Pattern '${application.pattern}' referenced by application '${application.id}' was not found.`,
						details: {
							applicationId: application.id,
							pattern: application.pattern,
							...(application._sourceDocumentId
								? { sourceDocumentId: application._sourceDocumentId }
								: {}),
						},
					}),
				);
				continue;
			}

			const ctx: MiniContext = { input: application.inputs ?? {} };

			let expandedDocs: CompileDocumentInput[];
			try {
				expandedDocs = expandApplication(decl, ctx);
			} catch (err) {
				diagnostics.push(
					error({
						code: "pattern.expansion.error",
						message: `Pattern expansion failed for application '${application.id}' (pattern '${application.pattern}'): ${err instanceof Error ? err.message : String(err)}`,
						details: {
							applicationId: application.id,
							pattern: application.pattern,
							...(application._sourceDocumentId
								? { sourceDocumentId: application._sourceDocumentId }
								: {}),
						},
					}),
				);
				continue;
			}

			collectDeclarations(expandedDocs, declarations);
			applications.push(...collectApplications(expandedDocs, application._sourceDocumentId));
			expanded.push(
				...expandedDocs.filter((d) => d.protocol !== PATTERN_PROTOCOL),
			);
		}

		depth += 1;
	}

	return { expanded, diagnostics };
}

function collectDeclarations(
	documents: readonly CompileDocumentInput[],
	declarations: Map<string, PatternDeclaration>,
): void {
	for (const doc of documents) {
		if (doc.protocol !== PATTERN_PROTOCOL) continue;
		const content = doc.document as PatternDocumentContent | null;
		if (!content) continue;
		for (const decl of content.patterns ?? []) {
			const nodeId = `pattern.declaration:${decl.id}`;
			declarations.set(nodeId, decl);
		}
	}
}

function collectApplications(
	documents: readonly CompileDocumentInput[],
	inheritedSourceId?: string,
): PatternApplication[] {
	const applications: PatternApplication[] = [];
	for (const doc of documents) {
		if (doc.protocol !== PATTERN_PROTOCOL) continue;
		const content = doc.document as PatternDocumentContent | null;
		if (!content) continue;
		for (const app of content.applications ?? []) {
			applications.push({
				...app,
				_sourceDocumentId: inheritedSourceId ?? doc.id,
			});
		}
	}
	return applications;
}

function expandApplication(
	decl: PatternDeclaration,
	ctx: MiniContext,
): CompileDocumentInput[] {
	const result: CompileDocumentInput[] = [];
	for (const template of decl.expands.documents) {
		const id = evalMini(evalExpansionValue(template.id), ctx);
		const protocol =
			typeof template.protocol === "string"
				? template.protocol
				: String(evalMini(evalExpansionValue(template.protocol), ctx));
		const document = evalExpansionTemplate(template.document, ctx);

		result.push({
			id: typeof id === "string" ? id : undefined,
			protocol,
			document,
		});
	}
	return result;
}

/**
 * Recursively walk a template value, evaluating any `{ expr: expression }`
 * wrappers as mini-language expressions with the given context.
 */
function evalExpansionTemplate(template: unknown, ctx: MiniContext): unknown {
	if (isExprWrapper(template)) {
		return evalMini(template.expr, ctx);
	}
	if (Array.isArray(template)) {
		const mapped = template.map((item) => evalExpansionTemplate(item, ctx));
		// If a map expression produces an array, flatten one level
		const result: unknown[] = [];
		for (const item of mapped) {
			if (Array.isArray(item)) result.push(...item);
			else result.push(item);
		}
		return result;
	}
	if (isRecord(template)) {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(template)) {
			result[key] = evalExpansionTemplate(value, ctx);
		}
		return result;
	}
	return template;
}

/**
 * For top-level field values in the expand template that may themselves be
 * `{ expr: ... }` wrappers, unwrap before passing to evalMini.
 */
function evalExpansionValue(value: unknown): unknown {
	if (isExprWrapper(value)) return value.expr;
	return value;
}

type ExprWrapper = { expr: unknown };

function isExprWrapper(value: unknown): value is ExprWrapper {
	return isRecord(value) && "expr" in value && Object.keys(value).length === 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
