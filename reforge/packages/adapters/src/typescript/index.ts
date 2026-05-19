import type { NodeVisitor, ParserAdapter, SourceLocation } from "@reforge/core";
import ts from "typescript";

// ─── Canonical kind names ─────────────────────────────────────────────────────
// TS 5.x uses range-marker aliases (FirstStatement = VariableStatement).
// We build a reverse map at module load time that always returns the real name.

const ALIAS_PREFIXES = new Set(["First", "Last", "Count"]);

function isAlias(name: string): boolean {
	for (const prefix of ALIAS_PREFIXES) {
		if (name.startsWith(prefix)) return true;
	}
	return false;
}

const canonicalKindName = new Map<number, string>();
for (const [name, val] of Object.entries(ts.SyntaxKind)) {
	if (typeof val !== "number") continue;
	if (isAlias(name)) continue;
	if (!canonicalKindName.has(val)) canonicalKindName.set(val, name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inferScriptKind(fileName: string): ts.ScriptKind {
	const ext = fileName.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "tsx":
			return ts.ScriptKind.TSX;
		case "jsx":
			return ts.ScriptKind.JSX;
		case "js":
		case "mjs":
		case "cjs":
			return ts.ScriptKind.JS;
		default:
			return ts.ScriptKind.TS;
	}
}

function locateNode(node: ts.Node): SourceLocation | null {
	if (node.pos < 0 || node.end < 0) return null;
	const sourceFile = node.getSourceFile();
	if (!sourceFile) return null;
	const start = node.getStart(sourceFile, false);
	const end = node.getEnd();
	if (start > end) return null;
	const startLC = sourceFile.getLineAndCharacterOfPosition(start);
	const endLC = sourceFile.getLineAndCharacterOfPosition(end);
	return {
		start: { offset: start, line: startLC.line + 1, column: startLC.character },
		end: { offset: end, line: endLC.line + 1, column: endLC.character },
	};
}

function findChildKey(parent: ts.Node, child: ts.Node): string | null {
	for (const [key, value] of Object.entries(parent)) {
		if (value === child) return key;
		if (Array.isArray(value) && (value as unknown[]).includes(child))
			return key;
	}
	return null;
}

function walkNode(
	node: ts.Node,
	parent: ts.Node | null,
	parentKey: string | null,
	visitor: NodeVisitor<ts.Node>,
): boolean {
	const ctrl = visitor.enter?.(node, parent, parentKey);
	if (ctrl === "stop") return true;
	if (ctrl !== "skip") {
		let stopped = false;
		node.forEachChild((child) => {
			if (stopped) return;
			if (walkNode(child, node, findChildKey(node, child), visitor))
				stopped = true;
		});
		if (stopped) return true;
	}
	visitor.leave?.(node, parent, parentKey);
	return false;
}

export interface TsParseOptions {
	fileName?: string;
	scriptKind?: ts.ScriptKind;
}

const _printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

// ─── Adapter ──────────────────────────────────────────────────────────────────

export const tsAdapter: ParserAdapter<ts.Node> = {
	language: "typescript",

	parse(source: string, options?: TsParseOptions): ts.Node {
		const fileName = options?.fileName ?? "file.ts";
		const scriptKind = options?.scriptKind ?? inferScriptKind(fileName);
		return ts.createSourceFile(
			fileName,
			source,
			ts.ScriptTarget.Latest,
			true,
			scriptKind,
		);
	},

	parseSnippet(source: string, options?: TsParseOptions): ts.Node {
		const sf = tsAdapter.parse(source, {
			fileName: "snippet.ts",
			...options,
		}) as ts.SourceFile;
		const first = sf.statements[0];
		if (!first) return sf;
		// Unwrap bare expression statements so snippet("foo()") → CallExpression
		if (ts.isExpressionStatement(first)) return first.expression;
		return first;
	},

	walk(root: ts.Node, visitor: NodeVisitor<ts.Node>): void {
		walkNode(root, null, null, visitor);
	},

	locate: locateNode,

	typeOf(node: ts.Node): string {
		return canonicalKindName.get(node.kind) ?? ts.SyntaxKind[node.kind];
	},

	print(node: ts.Node): string {
		const sf =
			node.getSourceFile() ??
			ts.createSourceFile(
				"out.ts",
				"",
				ts.ScriptTarget.Latest,
				false,
				ts.ScriptKind.TS,
			);
		return _printer.printNode(ts.EmitHint.Unspecified, node, sf);
	},
};

export { ts };

// ─── Semantic diff support ────────────────────────────────────────────────────

import type { Declaration } from "@reforge/core";

/**
 * Extract top-level declarations from a TypeScript AST for semantic diffing.
 * Uses the TypeScript compiler API for precise extraction — no regex heuristics.
 */
export function extractDeclarations(
	ast: ts.Node,
	source: string,
): Declaration[] {
	const sf = ast as ts.SourceFile;
	if (!ts.isSourceFile(sf)) return [];

	const decls: Declaration[] = [];

	for (const stmt of sf.statements) {
		const decl = extractStatement(stmt, sf, source);
		if (decl) decls.push(decl);
	}

	return decls;
}

function extractStatement(
	stmt: ts.Statement,
	sf: ts.SourceFile,
	source: string,
): Declaration | null {
	const line =
		sf.getLineAndCharacterOfPosition(stmt.getStart(sf, false)).line + 1;
	const text = source.slice(stmt.getStart(sf, false), stmt.end).split("\n")[0]; // first line
	const leadingComment = getLeadingComment(stmt, sf, source);

	// Import declaration
	if (ts.isImportDeclaration(stmt)) {
		const src = (stmt.moduleSpecifier as ts.StringLiteral).text;
		const clause = stmt.importClause;
		const defaultImp = clause?.name?.text;
		const specifiers: string[] = [];

		if (clause?.namedBindings) {
			if (ts.isNamedImports(clause.namedBindings)) {
				for (const el of clause.namedBindings.elements) {
					specifiers.push(el.name.text);
				}
			} else if (ts.isNamespaceImport(clause.namedBindings)) {
				specifiers.push(`* as ${clause.namedBindings.name.text}`);
			}
		}

		return {
			kind: "import",
			name: defaultImp ?? specifiers[0] ?? "",
			source: src,
			specifiers:
				specifiers.length > 0 ? specifiers : defaultImp ? [defaultImp] : [],
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Export declaration wrapping another declaration
	if (ts.isExportDeclaration(stmt)) return null; // re-exports, skip for now

	// Function declaration
	if (ts.isFunctionDeclaration(stmt) && stmt.name) {
		return {
			kind: "function",
			name: stmt.name.text,
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Class declaration
	if (ts.isClassDeclaration(stmt) && stmt.name) {
		return {
			kind: "class",
			name: stmt.name.text,
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Interface declaration
	if (ts.isInterfaceDeclaration(stmt)) {
		return {
			kind: "interface",
			name: stmt.name.text,
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Type alias
	if (ts.isTypeAliasDeclaration(stmt)) {
		return {
			kind: "type",
			name: stmt.name.text,
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Enum
	if (ts.isEnumDeclaration(stmt)) {
		return {
			kind: "enum",
			name: stmt.name.text,
			line,
			text: text ?? "",
			...(leadingComment !== undefined && { leadingComment }),
		};
	}

	// Variable statement (const/let/var)
	if (ts.isVariableStatement(stmt)) {
		const first = stmt.declarationList.declarations[0];
		if (first && ts.isIdentifier(first.name)) {
			return {
				kind: "variable",
				name: first.name.text,
				line,
				text: text ?? "",
				...(leadingComment !== undefined && { leadingComment }),
			};
		}
	}

	return null;
}

function getLeadingComment(
	stmt: ts.Statement,
	_sf: ts.SourceFile,
	source: string,
): string | undefined {
	const ranges = ts.getLeadingCommentRanges(source, stmt.pos);
	if (!ranges?.length) return undefined;
	return ranges.map((r) => source.slice(r.pos, r.end).trim()).join("\n");
}
