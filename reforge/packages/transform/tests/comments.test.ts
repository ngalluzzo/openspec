import { describe, expect, it } from "bun:test";
import { parse, print } from "../../core/src/index.js";
import type { NodeVisitor, ParserAdapter } from "../../core/src/types.js";
import { createQuery } from "../src/query.js";

function first<T>(arr: T[]): T {
	if (arr.length === 0) throw new Error("array is empty");
	const item = arr[0];
	if (item == null) throw new Error("array element is null");
	return item;
}

// ─── Fake adapter with realistic gaps ────────────────────────────────────────
// Each statement occupies one line, separated by real newlines.
// Supports leading and trailing comments in the source string.

type FakeNode = {
	type: string;
	value: string;
	start: number;
	end: number;
	children?: FakeNode[];
};

function buildAdapter(): ParserAdapter<FakeNode> {
	return {
		language: "fake",
		parse(source: string): FakeNode {
			// Split source into statement-like chunks separated by semicolons
			// Each chunk becomes a Stmt node with the correct offset.
			// This lets us write multi-statement sources with comments between them.
			const children: FakeNode[] = [];
			const stmtRegex = /[^\n;]+[;]?/g;
			while (true) {
				const m = stmtRegex.exec(source);
				if (m === null) break;
				const text = m[0].trim();
				if (!text || text.startsWith("//") || text.startsWith("/*")) continue;
				children.push({
					type: "Stmt",
					value: text,
					start: m.index,
					end: m.index + m[0].length,
				});
			}
			return {
				type: "Root",
				value: source,
				start: 0,
				end: source.length,
				children,
			};
		},
		parseSnippet(s: string): FakeNode {
			return { type: "Stmt", value: s, start: 0, end: s.length };
		},
		walk(root: FakeNode, visitor: NodeVisitor<FakeNode>): void {
			function visit(
				node: FakeNode,
				parent: FakeNode | null,
				key: string | null,
			) {
				visitor.enter?.(node, parent, key);
				for (const child of node.children ?? []) visit(child, node, "children");
				visitor.leave?.(node, parent, key);
			}
			visit(root, null, null);
		},
		locate: (n) => ({
			start: { offset: n.start, line: 1, column: 0 },
			end: { offset: n.end, line: 1, column: 0 },
		}),
		typeOf: (n) => n.type,
		print: (n) => n.value,
	};
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function setup(source: string) {
	const adapter = buildAdapter();
	const result = parse(source, { adapter });
	const query = createQuery(result);
	return { result, query, adapter };
}

// ─── leadingComments() ────────────────────────────────────────────────────────

describe("path.leadingComments()", () => {
	it("returns empty array when no leading comment", () => {
		const { query } = setup("const a = 1;");
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		expect(path.leadingComments()).toEqual([]);
	});

	it("finds a single line comment before a node", () => {
		const source = "// hello\nconst a = 1;";
		const { query } = setup(source);
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		const comments = path.leadingComments();
		expect(comments).toHaveLength(1);
		expect(first(comments).kind).toBe("line");
		expect(first(comments).text).toBe("hello");
	});

	it("finds a JSDoc block comment", () => {
		const source = "/** @param x the value */\nconst a = 1;";
		const { query } = setup(source);
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		const comments = path.leadingComments();
		expect(comments).toHaveLength(1);
		expect(first(comments).kind).toBe("block");
		expect(first(comments).raw).toMatch(/^\/\*\*/);
	});

	it("finds multiple leading comments", () => {
		const source = "// first\n// second\nconst a = 1;";
		const { query } = setup(source);
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		const comments = path.leadingComments();
		expect(comments).toHaveLength(2);
		expect(comments.map((c) => c.text)).toEqual(["first", "second"]);
	});
});

// ─── trailingComments() ───────────────────────────────────────────────────────

describe("path.trailingComments()", () => {
	it("returns empty when no trailing comment", () => {
		const { query } = setup("const a = 1;");
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		expect(path.trailingComments()).toEqual([]);
	});

	it("finds an inline trailing comment", () => {
		const source = "const a = 1; // inline\nconst b = 2;";
		const { query } = setup(source);
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		const comments = path.trailingComments();
		expect(comments).toHaveLength(1);
		expect(first(comments).kind).toBe("line");
		expect(first(comments).text).toBe("inline");
	});
});

// ─── comments() ──────────────────────────────────────────────────────────────

describe("path.comments()", () => {
	it("combines leading and trailing", () => {
		const source = "// leading\nconst a = 1; // trailing\n";
		const { query } = setup(source);
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		const all = path.comments();
		expect(all.length).toBeGreaterThanOrEqual(1);
		expect(all.some((c) => c.text === "leading")).toBe(true);
	});
});

// ─── jsdoc() ─────────────────────────────────────────────────────────────────

describe("path.jsdoc()", () => {
	it("returns null when no JSDoc", () => {
		const { query } = setup("const a = 1;");
		expect(query.find("Stmt").first()?.jsdoc()).toBeNull();
	});

	it("returns null for regular line comment", () => {
		const { query } = setup("// regular\nconst a = 1;");
		expect(query.find("Stmt").first()?.jsdoc()).toBeNull();
	});

	it("returns the JSDoc comment", () => {
		const source = "/** @returns the value */\nconst a = 1;";
		const { query } = setup(source);
		const jsdoc = query.find("Stmt").first()?.jsdoc();
		expect(jsdoc).not.toBeNull();
		expect(jsdoc?.text).toContain("@returns");
	});
});

// ─── addLeadingComment() ──────────────────────────────────────────────────────

describe("path.addLeadingComment()", () => {
	it("prepends a comment before the node in output", () => {
		const source = "const a = 1;";
		const { result, query } = setup(source);
		query.find("Stmt").first()?.addLeadingComment("// generated");
		const { code } = print(result);
		expect(code).toContain("// generated");
		expect(code.indexOf("// generated")).toBeLessThan(code.indexOf("const a"));
	});

	it("returns this for chaining", () => {
		const { query } = setup("const a = 1;");
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		expect(path.addLeadingComment("// x")).toBe(path);
	});
});

// ─── removeLeadingComments() ─────────────────────────────────────────────────

describe("path.removeLeadingComments()", () => {
	it("removes all leading comments when no predicate", () => {
		const source = "// remove me\nconst a = 1;";
		const { result, query } = setup(source);
		query.find("Stmt").first()?.removeLeadingComments();
		const { code } = print(result);
		expect(code).not.toContain("// remove me");
		expect(code).toContain("const a");
	});

	it("removes only comments matching predicate", () => {
		const source = "// keep\n// DEBUG: remove\nconst a = 1;";
		const { result, query } = setup(source);
		query
			.find("Stmt")
			.first()
			?.removeLeadingComments((c) => c.text.includes("DEBUG"));
		const { code } = print(result);
		expect(code).toContain("// keep");
		expect(code).not.toContain("DEBUG");
	});

	it("returns this for chaining with blank line methods", () => {
		const { query } = setup("// x\nconst a = 1;");
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		expect(path.removeLeadingComments()).toBe(path);
	});
});

// ─── replaceLeadingComment() ─────────────────────────────────────────────────

describe("path.replaceLeadingComment()", () => {
	it("replaces a matching comment", () => {
		const source = "// @param oldName description\nconst a = 1;";
		const { result, query } = setup(source);
		query
			.find("Stmt")
			.first()
			?.replaceLeadingComment(
				(c) => c.text.includes("oldName"),
				(c) => c.raw.replace("oldName", "newName"),
			);
		const { code } = print(result);
		expect(code).toContain("newName");
		expect(code).not.toContain("oldName");
	});

	it("no-op when predicate matches nothing", () => {
		const source = "// unrelated\nconst a = 1;";
		const { result, query } = setup(source);
		query
			.find("Stmt")
			.first()
			?.replaceLeadingComment(
				(c) => c.text.includes("NOPE"),
				() => "// x",
			);
		const { code } = print(result);
		expect(code).toContain("// unrelated");
	});

	it("returns this for chaining", () => {
		const { query } = setup("// x\nconst a = 1;");
		const foundPath = query.find("Stmt").first();
		if (foundPath == null) throw new Error("expected path");
		const path = foundPath;
		expect(
			path.replaceLeadingComment(
				() => false,
				() => "",
			),
		).toBe(path);
	});
});

// ─── findComments() ──────────────────────────────────────────────────────────

describe("query.findComments()", () => {
	it("returns empty when no comments match", () => {
		const { query } = setup("const a = 1;");
		expect(query.findComments(() => true)).toHaveLength(0);
	});

	it("finds all comments in the file", () => {
		const source = "// first\nconst a = 1;\n// second\nconst b = 2;";
		const { query } = setup(source);
		const all = query.findComments(() => true);
		expect(all.length).toBeGreaterThanOrEqual(2);
		const texts = all.map((cp) => cp.comment.text);
		expect(texts).toContain("first");
		expect(texts).toContain("second");
	});

	it("filters by predicate", () => {
		const source =
			"// TODO: fix this\nconst a = 1;\n// unrelated\nconst b = 2;";
		const { query } = setup(source);
		const todos = query.findComments((c) => c.text.includes("TODO"));
		expect(todos).toHaveLength(1);
		expect(first(todos).comment.text).toContain("TODO");
	});

	it("each CommentPath has a nodePath", () => {
		const source = "// leading\nconst a = 1;";
		const { query } = setup(source);
		const found = query.findComments(() => true);
		expect(found).toHaveLength(1);
		const cp = first(found);
		expect(cp.nodePath).toBeDefined();
		expect(cp.placement).toBe("leading");
	});

	it("CommentPath.remove() removes the comment from output", () => {
		const source = "// remove me\nconst a = 1;";
		const { result, query } = setup(source);
		const found = query.findComments((c) => c.text.includes("remove me"));
		expect(found).toHaveLength(1);
		const cp = first(found);
		cp.remove();
		const { code } = print(result);
		expect(code).not.toContain("remove me");
	});

	it("CommentPath.replace() replaces the comment text", () => {
		const source = "// @param oldName\nconst a = 1;";
		const { result, query } = setup(source);
		const found = query.findComments((c) => c.text.includes("oldName"));
		expect(found).toHaveLength(1);
		const cp = first(found);
		cp.replace("// @param newName");
		const { code } = print(result);
		expect(code).toContain("newName");
		expect(code).not.toContain("oldName");
	});

	it("finds TODO comments across multiple statements", () => {
		const source = [
			"// TODO: fix foo",
			"const a = 1;",
			"// unrelated comment",
			"const b = 2;",
			"// TODO: fix bar",
			"const c = 3;",
		].join("\n");
		const { query } = setup(source);
		const todos = query.findComments((c) => c.text.startsWith("TODO"));
		expect(todos).toHaveLength(2);
		const texts = todos.map((cp) => cp.comment.text);
		expect(texts).toContain("TODO: fix foo");
		expect(texts).toContain("TODO: fix bar");
	});
});

// ─── Chaining: comments + blank lines ─────────────────────────────────────────

describe("comment methods chain with blank line methods", () => {
	it("addLeadingComment chained with ensureBlankLineBefore", () => {
		const source = "const a = 1;\nconst b = 2;";
		const { result, query } = setup(source);
		const paths = query.find("Stmt").all();
		// Add a blank line and comment before the second statement
		const second = paths[1];
		if (second == null) throw new Error("expected second path");
		second.ensureBlankLineBefore().addLeadingComment("// section break");
		const { code } = print(result);
		expect(code).toContain("// section break");
	});
});
