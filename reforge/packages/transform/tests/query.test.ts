import { describe, expect, it, vi } from "bun:test";
import { parse } from "../../core/src/index.js";
import type { NodeVisitor, ParserAdapter } from "../../core/src/types.js";
import { createQuery } from "../src/query.js";

function first<T>(arr: T[]): T {
	if (arr.length === 0) throw new Error("array is empty");
	const item = arr[0];
	if (item == null) throw new Error("array element is null");
	return item;
}

// ─── A minimal but realistic fake adapter ────────────────────────────────────
// Models a tiny expression language:
//   program: { type:"Program", body: Statement[] }
//   statement: { type:"ExprStatement", expr: Expr }
//   call: { type:"CallExpr", callee: Identifier, args: Expr[] }
//   identifier: { type:"Identifier", name: string }
//   literal: { type:"Literal", value: string | number }

type ASTNode =
	| { type: "Program"; body: ASTNode[]; start: number; end: number }
	| { type: "ExprStatement"; expr: ASTNode; start: number; end: number }
	| {
			type: "CallExpr";
			callee: ASTNode;
			args: ASTNode[];
			start: number;
			end: number;
	  }
	| { type: "Identifier"; name: string; start: number; end: number }
	| { type: "Literal"; value: string | number; start: number; end: number };

function childrenOf(node: ASTNode): ASTNode[] {
	switch (node.type) {
		case "Program":
			return node.body;
		case "ExprStatement":
			return [node.expr];
		case "CallExpr":
			return [node.callee, ...node.args];
		default:
			return [];
	}
}

const fakeAdapter: ParserAdapter<ASTNode> = {
	language: "fake",

	parse(source: string): ASTNode {
		// Build a fixed AST representing: foo(bar, 42)\nbaz(qux)
		return {
			type: "Program",
			start: 0,
			end: source.length,
			body: [
				{
					type: "ExprStatement",
					start: 0,
					end: 11,
					expr: {
						type: "CallExpr",
						start: 0,
						end: 11,
						callee: { type: "Identifier", name: "foo", start: 0, end: 3 },
						args: [
							{ type: "Identifier", name: "bar", start: 4, end: 7 },
							{ type: "Literal", value: 42, start: 9, end: 11 },
						],
					},
				},
				{
					type: "ExprStatement",
					start: 12,
					end: 21,
					expr: {
						type: "CallExpr",
						start: 12,
						end: 21,
						callee: { type: "Identifier", name: "baz", start: 12, end: 15 },
						args: [{ type: "Identifier", name: "qux", start: 16, end: 19 }],
					},
				},
			],
		};
	},

	parseSnippet(source: string): ASTNode {
		return {
			type: "Identifier",
			name: source.trim(),
			start: 0,
			end: source.length,
		};
	},

	walk(root: ASTNode, visitor: NodeVisitor<ASTNode>): void {
		function visit(
			node: ASTNode,
			parent: ASTNode | null,
			key: string | null,
		): boolean {
			const ctrl = visitor.enter?.(node, parent, key);
			if (ctrl === "stop") return true;
			if (ctrl !== "skip") {
				const ch = childrenOf(node);
				for (const child of ch) {
					if (visit(child, node, keyOf(node, child))) return true;
				}
			}
			visitor.leave?.(node, parent, key);
			return false;
		}
		visit(root, null, null);
	},

	locate: (node) => ({
		start: { offset: node.start, line: 1, column: node.start },
		end: { offset: node.end, line: 1, column: node.end },
	}),

	typeOf: (node) => node.type,
};

function keyOf(parent: ASTNode, child: ASTNode): string {
	for (const [k, v] of Object.entries(parent)) {
		if (v === child) return k;
		if (Array.isArray(v) && v.includes(child)) return k;
	}
	return "unknown";
}

const SOURCE = "foo(bar, 42)\nbaz(qux)";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createQuery", () => {
	function makeQuery() {
		const result = parse(SOURCE, { adapter: fakeAdapter });
		return { result, query: createQuery(result) };
	}

	describe(".find()", () => {
		it("finds nodes by type", () => {
			const { query } = makeQuery();
			const paths = query.find("Identifier").all();
			expect(paths.length).toBe(4); // foo, bar, baz, qux
		});

		it("finds nodes by type + attribute equality", () => {
			const { query } = makeQuery();
			const paths = query.find("Identifier[name=foo]").all();
			expect(paths.length).toBe(1);
			const node = first(paths).node;
			if (node.type !== "Identifier") throw new Error("expected Identifier");
			expect(node.name).toBe("foo");
		});

		it("returns empty array for no matches", () => {
			const { query } = makeQuery();
			expect(query.find("DoesNotExist").all()).toHaveLength(0);
		});
	});

	describe(".where()", () => {
		it("narrows matches by predicate", () => {
			const { query } = makeQuery();
			const paths = query
				.find("Identifier")
				.where((p) => (p.node as { name: string }).name.length === 3)
				.all();
			expect(paths.length).toBe(4); // all are 3 chars
		});

		it("filters out non-matching nodes", () => {
			const { query } = makeQuery();
			const paths = query
				.find("Identifier")
				.where((p) => (p.node as { name: string }).name === "foo")
				.all();
			expect(paths.length).toBe(1);
		});
	});

	describe(".map()", () => {
		it("extracts values from matches", () => {
			const { query } = makeQuery();
			const names = query
				.find("Identifier")
				.map((p) => (p.node as { name: string }).name);
			expect(names.sort()).toEqual(["bar", "baz", "foo", "qux"]);
		});
	});

	describe(".count()", () => {
		it("returns the number of matches", () => {
			const { query } = makeQuery();
			expect(query.find("CallExpr").count()).toBe(2);
		});
	});

	describe(".first()", () => {
		it("returns the first match", () => {
			const { query } = makeQuery();
			const firstPath = query.find("CallExpr").first();
			if (firstPath == null) throw new Error("expected first path");
			const callee = (firstPath.node as { callee: { name: string } }).callee;
			expect(callee.name).toBe("foo");
		});

		it("returns null when no matches", () => {
			const { query } = makeQuery();
			expect(query.find("Ghost").first()).toBeNull();
		});
	});

	describe(".closest()", () => {
		it("navigates up to nearest ancestor of type", () => {
			const { query } = makeQuery();
			query.find("Identifier[name=bar]").all();
			const callPaths = query
				.find("Identifier[name=bar]")
				.closest("CallExpr")
				.all();
			expect(callPaths.length).toBe(1);
			const node = first(callPaths).node;
			if (node.type !== "CallExpr") throw new Error("expected CallExpr");
			if (node.callee.type !== "Identifier")
				throw new Error("expected Identifier");
			expect(node.callee.name).toBe("foo");
		});
	});

	describe(".mutate()", () => {
		it("applies mutations through reconcile", () => {
			const { result, query } = makeQuery();
			query.find("Identifier[name=foo]").mutate((p) => {
				(p.node as { name: string }).name = "renamed";
			});

			// The node should be mutated
			const program = result.ast;
			if (program.type !== "Program") throw new Error("expected Program");
			const body = program.body[0];
			if (body == null) throw new Error("expected body element");
			if (body.type !== "ExprStatement")
				throw new Error("expected ExprStatement");
			const callee = body.expr as { callee: { name: string } };
			expect(callee.callee.name).toBe("renamed");
		});

		it("is lazy — no walk until terminal op", () => {
			const { query } = makeQuery();
			const walkSpy = vi.spyOn(fakeAdapter, "walk");
			const chain = query.find("Identifier").where((_p) => true);
			// No walk yet
			expect(walkSpy).not.toHaveBeenCalled();
			// Terminal op triggers it
			chain.all();
			expect(walkSpy).toHaveBeenCalled();
			walkSpy.mockRestore();
		});
	});

	describe(".remove()", () => {
		it("removes matched nodes from parent arrays", () => {
			const { result, query } = makeQuery();
			// Remove the "bar" argument from foo(bar, 42)
			query.find("Identifier[name=bar]").remove();

			const program = result.ast;
			if (program.type !== "Program") throw new Error("expected Program");
			const body = program.body[0];
			if (body == null) throw new Error("expected body element");
			if (body.type !== "ExprStatement")
				throw new Error("expected ExprStatement");
			const fooCall = body.expr as { args: { value: number }[] };
			expect(fooCall.args).toHaveLength(1);
			expect(first(fooCall.args).value).toBe(42);
		});
	});

	describe("chained .find()", () => {
		it("scopes second find to children of first", () => {
			const { query } = makeQuery();
			// Find args inside the foo() call specifically
			const paths = query
				.find("CallExpr[callee.name=foo]")
				.find("Identifier")
				.all();
			// Should find bar (foo itself is the callee, not an arg identifier)
			const names = paths.map((p) => (p.node as { name: string }).name);
			expect(names).toContain("foo"); // callee
			expect(names).toContain("bar"); // arg
			expect(names).not.toContain("baz");
			expect(names).not.toContain("qux");
		});
	});

	describe("Path properties", () => {
		it("exposes parent and key", () => {
			const { query } = makeQuery();
			const foundPath = query.find("Identifier[name=bar]").first();
			if (foundPath == null) throw new Error("expected path");
			const path = foundPath;
			expect(path.parent).not.toBeNull();
			expect(path.key).toBe("args");
			expect(path.index).toBe(0);
		});

		it("exposes source slice", () => {
			const { query } = makeQuery();
			const foundPath = query.find("Identifier[name=foo]").first();
			if (foundPath == null) throw new Error("expected path");
			const path = foundPath;
			expect(path.source).toBe("foo");
		});

		it(".siblings() returns other nodes in the same array", () => {
			const { query } = makeQuery();
			const foundBarPath = query.find("Identifier[name=bar]").first();
			if (foundBarPath == null) throw new Error("expected bar path");
			const barPath = foundBarPath;
			const sibs = barPath.siblings();
			expect(sibs.length).toBe(1);
			const sibNode = first(sibs).node;
			if (sibNode.type !== "Literal") throw new Error("expected Literal");
			expect(sibNode.value).toBe(42);
		});

		it(".next() returns the next sibling", () => {
			const { query } = makeQuery();
			const foundBarPath = query.find("Identifier[name=bar]").first();
			if (foundBarPath == null) throw new Error("expected bar path");
			const barPath = foundBarPath;
			const next = barPath.next();
			if (next == null) throw new Error("expected next sibling");
			const nextNode = next.node;
			if (nextNode.type !== "Literal") throw new Error("expected Literal");
			expect(nextNode.value).toBe(42);
		});

		it(".prev() returns null for first item", () => {
			const { query } = makeQuery();
			const foundBarPath = query.find("Identifier[name=bar]").first();
			if (foundBarPath == null) throw new Error("expected bar path");
			const barPath = foundBarPath;
			expect(barPath.prev()).toBeNull();
		});
	});
});
