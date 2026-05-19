import { describe, expect, it } from "bun:test";
import {
	applyGapOverride,
	createGapOverrideMap,
	setLeadingNewlines,
} from "../src/gaps.js";
import { parse, print } from "../src/index.js";
import type { NodeVisitor, ParserAdapter } from "../src/types.js";

// ─── setLeadingNewlines ───────────────────────────────────────────────────────

describe("setLeadingNewlines", () => {
	it("adds a blank line (1 → 2 newlines)", () => {
		expect(setLeadingNewlines("\n  ", 2)).toBe("\n\n  ");
	});

	it("removes a blank line (2 → 1 newline)", () => {
		expect(setLeadingNewlines("\n\n  ", 1)).toBe("\n  ");
	});

	it("collapses multiple blank lines to one", () => {
		expect(setLeadingNewlines("\n\n\n  ", 1)).toBe("\n  ");
	});

	it("collapses to zero newlines (n=0)", () => {
		expect(setLeadingNewlines("\n  ", 0)).toBe("  ");
	});

	it("handles no indent after newline", () => {
		expect(setLeadingNewlines("\n", 2)).toBe("\n\n");
		expect(setLeadingNewlines("\n\n", 1)).toBe("\n");
	});

	it("is idempotent when count already matches", () => {
		expect(setLeadingNewlines("\n\n  ", 2)).toBe("\n\n  ");
		expect(setLeadingNewlines("\n  ", 1)).toBe("\n  ");
	});

	it("handles gap with leading spaces before newline", () => {
		expect(setLeadingNewlines("  \n  ", 2)).toBe("\n\n  ");
	});

	it("preserves content after the leading whitespace", () => {
		// gap = '\n  // comment\n  next' — only leading newlines change
		expect(setLeadingNewlines("\n  text", 2)).toBe("\n\n  text");
	});

	it("throws on negative n", () => {
		expect(() => setLeadingNewlines("\n", -1)).toThrow(RangeError);
	});
});

// ─── applyGapOverride ─────────────────────────────────────────────────────────

describe("applyGapOverride", () => {
	it("applies 'before' override", () => {
		expect(applyGapOverride("\n  ", { before: 2 }, "before")).toBe("\n\n  ");
	});

	it("applies 'after' override", () => {
		expect(applyGapOverride("\n  ", { after: 2 }, "after")).toBe("\n\n  ");
	});

	it("no-op when no matching override", () => {
		expect(applyGapOverride("\n  ", { after: 2 }, "before")).toBe("\n  ");
		expect(applyGapOverride("\n  ", undefined, "before")).toBe("\n  ");
	});

	it("applies n=0 (remove blank lines)", () => {
		expect(applyGapOverride("\n\n  ", { before: 0 }, "before")).toBe("  ");
	});
});

// ─── createGapOverrideMap ─────────────────────────────────────────────────────

describe("createGapOverrideMap", () => {
	it("stores and retrieves overrides by node identity", () => {
		const targets = new Set<object>();
		const map = createGapOverrideMap<object>(targets);
		const node = {};
		map.set(node, { before: 2 });
		expect(map.get(node)).toEqual({ before: 2 });
		expect(targets.has(node)).toBe(true);
	});

	it("merges partial overrides", () => {
		const targets = new Set<object>();
		const map = createGapOverrideMap<object>(targets);
		const node = {};
		map.set(node, { before: 1 });
		map.set(node, { after: 2 });
		expect(map.get(node)).toEqual({ before: 1, after: 2 });
	});

	it("returns undefined for unseen nodes", () => {
		const targets = new Set<object>();
		const map = createGapOverrideMap<object>(targets);
		expect(map.get({})).toBeUndefined();
	});

	it("populates overrideTargets when set() is called", () => {
		const targets = new Set<object>();
		const map = createGapOverrideMap<object>(targets);
		const a = {},
			b = {};
		map.set(a, { before: 1 });
		expect(targets.size).toBe(1);
		expect(targets.has(a)).toBe(true);
		expect(targets.has(b)).toBe(false);
	});
});

// ─── Integration: blank line control in the printer ───────────────────────────

type FakeNode = {
	type: string;
	value: string;
	start: number;
	end: number;
	children?: FakeNode[];
};

const fakeAdapter: ParserAdapter<FakeNode> = {
	language: "fake",
	parse(source): FakeNode {
		// Build a 3-statement AST from lines separated by '\n'
		const lines = source.split("\n");
		let offset = 0;
		const children: FakeNode[] = lines.map((line) => {
			const node: FakeNode = {
				type: "Stmt",
				value: line,
				start: offset,
				end: offset + line.length,
			};
			offset += line.length + 1;
			return node;
		});
		return {
			type: "Root",
			value: source,
			start: 0,
			end: source.length,
			children,
		};
	},
	parseSnippet(source): FakeNode {
		return { type: "Stmt", value: source, start: 0, end: source.length };
	},
	walk(root, visitor: NodeVisitor<FakeNode>) {
		function visit(node: FakeNode, parent: FakeNode | null) {
			const ctrl = visitor.enter?.(node, parent, null);
			if (ctrl !== "skip" && ctrl !== "stop") {
				for (const child of node.children ?? []) visit(child, node);
			}
			visitor.leave?.(node, parent, null);
		}
		visit(root, null);
	},
	locate: (n) => ({
		start: { offset: n.start, line: 1, column: 0 },
		end: { offset: n.end, line: 1, column: 0 },
	}),
	typeOf: (n) => n.type,
	print: (n) => (n as FakeNode).value,
};

describe("blank line control — printer integration", () => {
	it("identity: no overrides, source unchanged", () => {
		const source = "aaa\nbbb\nccc";
		const result = parse(source, { adapter: fakeAdapter });
		expect(print(result).code).toBe(source);
	});

	it("setBlankLinesBefore(2) adds a blank line before a node", () => {
		const source = "aaa\nbbb\nccc";
		const result = parse(source, { adapter: fakeAdapter });
		// Override the gap before 'bbb' (second child)
		const children = (result.ast as FakeNode).children ?? [];
		const bbb = children[1];
		if (bbb == null) throw new Error("expected bbb node");
		result.gapOverrides.set(bbb, { before: 2 });
		const { code } = print(result);
		expect(code).toBe("aaa\n\nbbb\nccc");
	});

	it("setBlankLinesBefore(0) removes blank lines before a node", () => {
		const source = "aaa\n\nbbb\nccc";
		const result = parse(source, { adapter: fakeAdapter });
		const children = (result.ast as FakeNode).children ?? [];
		const bbb = children[1];
		if (bbb == null) throw new Error("expected bbb node");
		result.gapOverrides.set(bbb, { before: 0 });
		const { code } = print(result);
		// The gap '\n\n' becomes '' (0 newlines) + indent ('') = ''
		// so bbb ends up right after aaa with no newline
		expect(code).not.toContain("\n\n");
	});

	it("setLeadingNewlines collapses multiple newlines correctly", () => {
		expect(setLeadingNewlines("\n\n\n\n", 1)).toBe("\n");
		expect(setLeadingNewlines("\n\n\n\n  ", 1)).toBe("\n  ");
		expect(setLeadingNewlines("\n\n\n\n  ", 2)).toBe("\n\n  ");
	});
});
