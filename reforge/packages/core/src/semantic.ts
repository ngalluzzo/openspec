/**
 * Semantic diff — describes CONCEPTS that changed, not characters.
 *
 * A unified diff tells you which lines moved. A semantic diff tells you:
 *   - "Import renamed: 'lodash' → 'lodash-es'"
 *   - "Function added: validateToken"
 *   - "Type declaration removed: UserProps"
 *   - "JSDoc updated on: processPayment"
 *
 * v1 scope: declaration-level changes at the top of a file.
 * Expression-level changes inside function bodies are handled well enough
 * by line diffs — semantic diff adds value at the structural boundary level.
 */

// ─── Change kinds ─────────────────────────────────────────────────────────────

export type SemanticChangeKind =
	// Declarations (functions, classes, types, variables, interfaces)
	| "declaration:added"
	| "declaration:removed"
	| "declaration:renamed"
	// Imports
	| "import:added"
	| "import:removed"
	| "import:source-changed"
	| "import:specifiers-changed"
	// Comments / JSDoc
	| "comment:added"
	| "comment:removed"
	| "comment:updated"
	// Catch-all for detected structural changes that don't fit the above
	| "node:modified";

// ─── Change descriptors ───────────────────────────────────────────────────────

export interface SemanticChange {
	kind: SemanticChangeKind;
	/** Short human-readable summary: "Function 'foo' renamed to 'bar'" */
	summary: string;
	/** What it was before (name, import path, comment text, etc.) */
	before?: string;
	/** What it is now */
	after?: string;
	/** Source location in the MODIFIED file */
	location?: { line: number; column: number };
	/**
	 * Surrounding context — what scope this change lives in.
	 * e.g. "class UserService", "module", "namespace Auth"
	 */
	context?: string;
}

// ─── Declaration descriptor — adapter-provided ────────────────────────────────

/**
 * A top-level declaration as extracted by the adapter's extractDeclarations().
 * The adapter knows what counts as a meaningful declaration in its language.
 */
export interface Declaration {
	/** Canonical type name: "function", "class", "type", "interface", "variable",
	 *  "enum", "import", "export" — adapter-defined, used for grouping */
	kind: string;
	/** The declaration's name/identifier (undefined for unnamed exports etc.) */
	name?: string;
	/** For imports: the module specifier */
	source?: string;
	/** For imports: the imported names */
	specifiers?: string[];
	/** Source location in the file */
	line: number;
	/** The raw source text of just this declaration */
	text: string;
	/** Any leading JSDoc or comment block */
	leadingComment?: string;
}

// ─── Adapter extension ────────────────────────────────────────────────────────
// This is the optional method added to ParserAdapter.
// Declared here to keep semantic.ts self-contained; the adapter interface
// is extended via module augmentation in the adapter packages.

export type ExtractDeclarationsFn<TNode extends object> = (
	ast: TNode,
	source: string,
) => Declaration[];

// ─── Core algorithm ───────────────────────────────────────────────────────────

/**
 * Compute semantic changes between two versions of source code.
 *
 * If the adapter provides extractDeclarations(), it is used for precise
 * language-aware extraction. Otherwise falls back to comment-based heuristics
 * (which work surprisingly well for common patterns).
 *
 * Returns an empty array if the sources are identical or if no semantic-level
 * changes are detected (expression-only changes produce no semantic changes).
 */
export function semanticDiff<TNode extends object>(
	before: string,
	after: string,
	opts: {
		extractDeclarations?: ExtractDeclarationsFn<TNode>;
		beforeAst?: TNode;
		afterAst?: TNode;
	} = {},
): SemanticChange[] {
	if (before === after) return [];

	const { extractDeclarations } = opts;

	let beforeDecls: Declaration[];
	let afterDecls: Declaration[];

	if (extractDeclarations && opts.beforeAst && opts.afterAst) {
		beforeDecls = extractDeclarations(opts.beforeAst, before);
		afterDecls = extractDeclarations(opts.afterAst, after);
	} else {
		// Generic fallback: extract declarations by scanning source text
		beforeDecls = extractDeclarationsGeneric(before);
		afterDecls = extractDeclarationsGeneric(after);
	}

	return diffDeclarations(beforeDecls, afterDecls, before, after);
}

// ─── Declaration diffing ──────────────────────────────────────────────────────

function diffDeclarations(
	before: Declaration[],
	after: Declaration[],
	_beforeSrc: string,
	_afterSrc: string,
): SemanticChange[] {
	const changes: SemanticChange[] = [];

	// Separate imports from other declarations
	const beforeImports = before.filter((d) => d.kind === "import");
	const afterImports = after.filter((d) => d.kind === "import");
	const beforeDecls = before.filter((d) => d.kind !== "import");
	const afterDecls = after.filter((d) => d.kind !== "import");

	// Diff imports
	changes.push(...diffImports(beforeImports, afterImports));

	// Diff declarations
	changes.push(...diffNamedDeclarations(beforeDecls, afterDecls));

	return changes;
}

// ─── Import diffing ───────────────────────────────────────────────────────────

function diffImports(
	before: Declaration[],
	after: Declaration[],
): SemanticChange[] {
	const changes: SemanticChange[] = [];

	const beforeBySource = new Map(before.map((d) => [d.source ?? "", d]));
	const afterBySource = new Map(after.map((d) => [d.source ?? "", d]));

	// Removed imports
	for (const [src, d] of beforeBySource) {
		if (!afterBySource.has(src)) {
			changes.push({
				kind: "import:removed",
				summary: `Import removed: '${src}'`,
				before: d.text,
				context: "module",
			});
		}
	}

	// Added imports
	for (const [src, d] of afterBySource) {
		if (!beforeBySource.has(src)) {
			changes.push({
				kind: "import:added",
				summary: `Import added: '${src}'`,
				after: d.text,
				location: { line: d.line, column: 0 },
				context: "module",
			});
		}
	}

	// Changed imports (same source, different bindings or specifiers)
	for (const [src, beforeD] of beforeBySource) {
		const afterD = afterBySource.get(src);
		if (!afterD) continue;

		const beforeSpecs = (beforeD.specifiers ?? []).slice().sort().join(", ");
		const afterSpecs = (afterD.specifiers ?? []).slice().sort().join(", ");

		if (beforeSpecs !== afterSpecs) {
			const beforeVal = beforeSpecs || beforeD.name;
			const afterVal = afterSpecs || afterD.name;
			if (beforeVal == null || afterVal == null) continue;
			changes.push({
				kind: "import:specifiers-changed",
				summary: `Import specifiers changed for '${src}': { ${beforeSpecs} } → { ${afterSpecs} }`,
				before: beforeVal,
				after: afterVal,
				location: { line: afterD.line, column: 0 },
				context: "module",
			});
		}
	}

	// Source-changed imports (same binding name, different source)
	const beforeByName = new Map<string, Declaration>();
	for (const d of before) {
		if (d.name != null) beforeByName.set(d.name, d);
	}
	const afterByName = new Map<string, Declaration>();
	for (const d of after) {
		if (d.name != null) afterByName.set(d.name, d);
	}

	for (const [name, beforeD] of beforeByName) {
		const afterD = afterByName.get(name);
		if (!afterD) continue;
		if (afterBySource.has(beforeD.source ?? "")) continue; // already handled above
		if (beforeD.source !== afterD.source) {
			const beforeSrc = beforeD.source;
			const afterSrc = afterD.source;
			if (beforeSrc == null || afterSrc == null) continue;
			changes.push({
				kind: "import:source-changed",
				summary: `Import source changed: '${beforeSrc}' → '${afterSrc}'`,
				before: beforeSrc,
				after: afterSrc,
				location: { line: afterD.line, column: 0 },
				context: "module",
			});
		}
	}

	return changes;
}

// ─── Named declaration diffing ────────────────────────────────────────────────

function diffNamedDeclarations(
	before: Declaration[],
	after: Declaration[],
): SemanticChange[] {
	const changes: SemanticChange[] = [];

	const beforeByName = new Map<string, Declaration>();
	for (const d of before) {
		if (d.name != null) beforeByName.set(d.name, d);
	}
	const afterByName = new Map<string, Declaration>();
	for (const d of after) {
		if (d.name != null) afterByName.set(d.name, d);
	}

	// Removed declarations
	for (const [name, d] of beforeByName) {
		if (!afterByName.has(name)) {
			// Could be a rename — check if something at the same position has a new name
			const rename = findRename(d, before, after, beforeByName, afterByName);
			if (rename && rename.name != null) {
				changes.push({
					kind: "declaration:renamed",
					summary: `${capitalise(d.kind)} renamed: '${name}' → '${rename.name}'`,
					before: name,
					after: rename.name,
					location: { line: rename.line, column: 0 },
					context: "module",
				});
				// Mark the rename target as seen so we don't double-report
				afterByName.delete(rename.name);
			} else {
				changes.push({
					kind: "declaration:removed",
					summary: `${capitalise(d.kind)} removed: '${name}'`,
					before: name,
					context: "module",
				});
			}
		}
	}

	// Added declarations (that weren't part of a rename)
	for (const [name, d] of afterByName) {
		if (!beforeByName.has(name)) {
			changes.push({
				kind: "declaration:added",
				summary: `${capitalise(d.kind)} added: '${name}'`,
				after: name,
				location: { line: d.line, column: 0 },
				context: "module",
			});
		}
	}

	// Comment/JSDoc changes on existing declarations
	for (const [name, beforeD] of beforeByName) {
		const afterD = afterByName.get(name);
		if (!afterD) continue;

		const bc = beforeD.leadingComment?.trim() ?? "";
		const ac = afterD.leadingComment?.trim() ?? "";

		if (bc !== ac) {
			if (!bc && ac) {
				changes.push({
					kind: "comment:added",
					summary: `Comment added to '${name}'`,
					after: ac,
					location: { line: afterD.line, column: 0 },
					context: name,
				});
			} else if (bc && !ac) {
				changes.push({
					kind: "comment:removed",
					summary: `Comment removed from '${name}'`,
					before: bc,
					context: name,
				});
			} else {
				changes.push({
					kind: "comment:updated",
					summary: `Comment updated on '${name}'`,
					before: bc,
					after: ac,
					location: { line: afterD.line, column: 0 },
					context: name,
				});
			}
		}
	}

	return changes;
}

/**
 * Heuristic rename detection: if a declaration was removed and a new one
 * of the same kind appeared near the same position, it was likely renamed.
 */
function findRename(
	removed: Declaration,
	_before: Declaration[],
	_after: Declaration[],
	beforeByName: Map<string, Declaration>,
	afterByName: Map<string, Declaration>,
): Declaration | null {
	// A new declaration of the same kind that doesn't exist in before
	for (const [name, d] of afterByName) {
		if (beforeByName.has(name)) continue; // exists in both — not a rename
		if (d.kind !== removed.kind) continue; // different kind — not a rename
		// Position heuristic: within 10 lines of original
		if (Math.abs(d.line - removed.line) <= 10) return d;
	}
	return null;
}

// ─── Generic fallback extractor ───────────────────────────────────────────────

/**
 * Extract declarations from source text without a parser.
 * Uses regex patterns that work for TypeScript/JavaScript.
 * Good enough for common patterns; adapters can override with precise AST walking.
 */
function extractDeclarationsGeneric(source: string): Declaration[] {
	const decls: Declaration[] = [];
	const lines = source.split("\n");

	// Patterns for common declaration forms
	const patterns: Array<{ kind: string; re: RegExp }> = [
		{
			kind: "import",
			re: /^import\s+(?:type\s+)?(.+?)\s+from\s+['"]([^'"]+)['"]/,
		},
		{ kind: "function", re: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/ },
		{ kind: "class", re: /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/ },
		{ kind: "type", re: /^(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/ },
		{ kind: "interface", re: /^(?:export\s+)?interface\s+(\w+)/ },
		{ kind: "enum", re: /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/ },
		{ kind: "variable", re: /^(?:export\s+)?(?:const|let|var)\s+(\w+)/ },
	];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line == null) continue;
		const trimmedLine = line.trim();
		if (
			!trimmedLine ||
			trimmedLine.startsWith("//") ||
			trimmedLine.startsWith("*")
		)
			continue;

		// Collect leading comment
		let leadingComment: string | undefined;
		if (i > 0) {
			const commentLines: string[] = [];
			let j = i - 1;
			while (j >= 0) {
				const commentLine = lines[j];
				if (commentLine == null) {
					j--;
					continue;
				}
				const ct = commentLine.trim();
				if (ct.startsWith("//") || ct.startsWith("*") || ct.startsWith("/*")) {
					commentLines.unshift(ct);
				}
				j--;
			}
			if (commentLines.length) leadingComment = commentLines.join("\n");
		}

		for (const { kind, re } of patterns) {
			const m = line.match(re);
			if (!m) continue;

			if (kind === "import") {
				// Extract source and specifiers from import
				const sourceMatch = line.match(/from\s+['"]([^'"]+)['"]/);
				const src = sourceMatch?.[1];
				const specifiers = extractImportSpecifiers(line);
				const defaultImport = extractDefaultImport(line);
				const name = defaultImport ?? specifiers[0];
				const entry: Declaration = {
					kind: "import",
					specifiers:
						specifiers.length > 0
							? specifiers
							: defaultImport
								? [defaultImport]
								: [],
					line: i + 1,
					text: line,
				};
				if (name != null) entry.name = name;
				if (src != null) entry.source = src;
				if (leadingComment != null) entry.leadingComment = leadingComment;
				decls.push(entry);
			} else {
				const entry: Declaration = {
					kind,
					line: i + 1,
					text: line,
				};
				if (m[1] != null) entry.name = m[1];
				if (leadingComment != null) entry.leadingComment = leadingComment;
				decls.push(entry);
			}
			break;
		}
	}

	return decls;
}

function extractImportSpecifiers(importLine: string): string[] {
	const m = importLine.match(/\{([^}]+)\}/);
	if (!m || m[1] == null) return [];
	return m[1]
		.split(",")
		.map((s) => s.trim().replace(/\s+as\s+\w+/, ""))
		.filter(Boolean);
}

function extractDefaultImport(importLine: string): string | undefined {
	// import Foo from '...' — extract Foo
	const m = importLine.match(/^import\s+(?:type\s+)?(\w+)\s+from/);
	return m?.[1];
}

function capitalise(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format semantic changes into a compact human-readable string.
 * Suitable for PR descriptions, commit messages, or CLI output.
 */
export function formatSemanticChanges(
	changes: SemanticChange[],
	opts: { filePath?: string; indent?: string } = {},
): string {
	if (changes.length === 0) return "";

	const { filePath, indent = "" } = opts;
	const lines: string[] = [];

	if (filePath) lines.push(`${indent}${filePath}`);

	// Group by kind prefix for a cleaner display
	const groups = new Map<string, SemanticChange[]>();
	for (const c of changes) {
		const parts = c.kind.split(":"); // "import", "declaration", "comment"
		const prefix = parts[0];
		if (prefix == null) continue;
		const arr = groups.get(prefix);
		if (arr) {
			arr.push(c);
		} else {
			groups.set(prefix, [c]);
		}
	}

	for (const [, groupChanges] of groups) {
		for (const c of groupChanges) {
			lines.push(`${indent}  ${bulletFor(c.kind)} ${c.summary}`);
		}
	}

	return lines.join("\n");
}

function bulletFor(kind: SemanticChangeKind): string {
	if (kind.endsWith(":added")) return "+";
	if (kind.endsWith(":removed")) return "-";
	if (kind.endsWith(":renamed")) return "~";
	if (kind.endsWith(":source-changed")) return "~";
	if (kind.endsWith(":specifiers-changed")) return "~";
	if (kind.endsWith(":updated")) return "~";
	return "·";
}
