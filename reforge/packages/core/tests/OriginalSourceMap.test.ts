import { describe, expect, it } from "bun:test";
import { OriginalSourceMap } from "../src/OriginalSourceMap.js";
import type { ParserAdapter } from "../src/types.js";

// ─── Minimal fake adapter for unit testing ────────────────────────────────────

interface FakeNode {
	type: string;
	value?: string;
	start: number;
	end: number;
	children?: FakeNode[];
}

const fakeAdapter: ParserAdapter<FakeNode> = {
	language: "fake",
	parse: () => ({ type: "Root", start: 0, end: 0 }),
	parseSnippet: () => ({ type: "Root", start: 0, end: 0 }),
	walk(root, visitor) {
		function visit(node: FakeNode, parent: FakeNode | null) {
			visitor.enter?.(node, parent, null);
			for (const child of node.children ?? []) visit(child, node);
			visitor.leave?.(node, parent, null);
		}
		visit(root, null);
	},
	locate: (node) => ({
		start: { offset: node.start, line: 1, column: node.start },
		end: { offset: node.end, line: 1, column: node.end },
	}),
	typeOf: (node) => node.type,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("OriginalSourceMap", () => {
	const source = "hello world";

	function makeNode(
		type: string,
		start: number,
		end: number,
		value?: string,
	): FakeNode {
		const node: FakeNode = { type, start, end };
		if (value != null) node.value = value;
		return node;
	}

	it("stores and retrieves original slice", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5, "hello");
		map.snapshot(node);

		expect(map.originalSlice(node)).toBe("hello");
	});

	it("stores and retrieves original location", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 6, 11, "world");
		map.snapshot(node);

		expect(map.originalLocation(node)).toEqual({
			start: { offset: 6, line: 1, column: 6 },
			end: { offset: 11, line: 1, column: 11 },
		});
	});

	it("isModified returns false for unmodified node", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5, "hello");
		map.snapshot(node);

		expect(map.isModified(node)).toBe(false);
	});

	it("isModified returns true after mutating a scalar property", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5, "hello");
		map.snapshot(node);

		node.value = "goodbye"; // mutate!

		expect(map.isModified(node)).toBe(true);
	});

	it("isModified returns true for nodes marked new", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5);
		map.markNew(node);

		expect(map.isModified(node)).toBe(true);
	});

	it("returns null for unseen nodes", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5);
		// never snapshot()ed

		expect(map.originalSlice(node)).toBeNull();
		expect(map.originalLocation(node)).toBeNull();
	});

	it("isModified returns true for unseen nodes", () => {
		const map = new OriginalSourceMap(fakeAdapter, source);
		const node = makeNode("Word", 0, 5);

		expect(map.isModified(node)).toBe(true);
	});
});
