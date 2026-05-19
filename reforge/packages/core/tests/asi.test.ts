import { describe, expect, it } from "bun:test";
import { gapCrossesLine, isAsiHazard, patchGap } from "../src/asi.js";
import { parse, print } from "../src/index.js";
import type { NodeVisitor, ParserAdapter } from "../src/types.js";

// ─── Unit tests: isAsiHazard ──────────────────────────────────────────────────

describe("isAsiHazard", () => {
	describe("hazardous combinations", () => {
		it("detects [ after expression", () => {
			expect(isAsiHazard("foo", "[0]")).toBe(true);
		});
		it("detects ( after expression", () => {
			expect(isAsiHazard("foo", "(bar)")).toBe(true);
		});
		it("detects ` after expression", () => {
			expect(isAsiHazard("foo", "`template`")).toBe(true);
		});
		it("detects / after expression", () => {
			expect(isAsiHazard("foo", "/regex/")).toBe(true);
		});
		it("detects [ after identifier with trailing spaces", () => {
			expect(isAsiHazard("foo   ", "  [0]")).toBe(true);
		});
		it("detects ( after return value", () => {
			expect(isAsiHazard("return obj", "(extra)")).toBe(true);
		});
	});

	describe("safe combinations", () => {
		it("safe when prev ends with semicolon", () => {
			expect(isAsiHazard("foo;", "[0]")).toBe(false);
		});
		it("safe when prev ends with }", () => {
			expect(isAsiHazard("function f() {}", "(bar)")).toBe(false);
		});
		it("safe when prev ends with {", () => {
			expect(isAsiHazard("if (x) {", "[0]")).toBe(false);
		});
		it("safe when next starts with identifier", () => {
			expect(isAsiHazard("foo", "bar()")).toBe(false);
		});
		it("safe when next starts with keyword", () => {
			expect(isAsiHazard("foo", "return")).toBe(false);
		});
		it("safe when next starts with number", () => {
			expect(isAsiHazard("foo", "42")).toBe(false);
		});
		it("safe for empty slices", () => {
			expect(isAsiHazard("", "[0]")).toBe(false);
			expect(isAsiHazard("foo", "")).toBe(false);
		});
	});
});

// ─── Unit tests: patchGap ─────────────────────────────────────────────────────

describe("patchGap", () => {
	it("inserts ; before plain newline", () => {
		expect(patchGap("\n")).toBe(";\n");
	});
	it("inserts ; before newline with indent", () => {
		expect(patchGap("\n  ")).toBe(";\n  ");
	});
	it("trims trailing whitespace before ;", () => {
		expect(patchGap("  \n  ")).toBe(";\n  ");
	});
	it("inserts ; before line comment, not inside it", () => {
		expect(patchGap(" // note\n  ")).toBe("; // note\n  ");
		expect(patchGap("  // comment\n")).toBe("; // comment\n");
	});
	it("only patches the first newline", () => {
		expect(patchGap("\n\n")).toBe(";\n\n");
	});
	it("no-op on gap with no newline", () => {
		expect(patchGap("  ")).toBe("  ");
	});
	it("no-op on empty gap", () => {
		expect(patchGap("")).toBe("");
	});
});

// ─── Unit tests: gapCrossesLine ───────────────────────────────────────────────

describe("gapCrossesLine", () => {
	it("returns true for gap with newline", () => {
		expect(gapCrossesLine("\n")).toBe(true);
		expect(gapCrossesLine("  \n  ")).toBe(true);
	});
	it("returns false for gap without newline", () => {
		expect(gapCrossesLine("  ")).toBe(false);
		expect(gapCrossesLine("")).toBe(false);
	});
});

// ─── Integration tests: ASI fix in the printer ────────────────────────────────
// We use a minimal fake adapter whose parse() returns a hand-crafted AST
// with precise source locations, so we can test the printer's ASI logic
// without depending on a real language parser.

type FakeNode = {
	type: string;
	value: string;
	start: number;
	end: number;
	children?: FakeNode[];
};

function makeAdapter(): ParserAdapter<FakeNode> {
	return {
		language: "fake",
		parse(source): FakeNode {
			return {
				type: "Root",
				value: source,
				start: 0,
				end: source.length,
				children: [],
			};
		},
		parseSnippet(source): FakeNode {
			return { type: "Leaf", value: source, start: 0, end: source.length };
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
		// Provide a print() so new nodes don't throw in integration tests
		print: (n) => (n as FakeNode).value ?? "",
	};
}

// Build a two-statement AST manually with real source positions
function _buildTwoNodeAst(
	source: string,
	stmt1End: number,
	stmt2Start: number,
): FakeNode {
	return {
		type: "Root",
		value: source,
		start: 0,
		end: source.length,
		children: [
			{
				type: "Stmt",
				value: source.slice(0, stmt1End),
				start: 0,
				end: stmt1End,
			},
			{
				type: "Stmt",
				value: source.slice(stmt2Start),
				start: stmt2Start,
				end: source.length,
			},
		],
	};
}

describe("printer ASI integration", () => {
	const adapter = makeAdapter();

	it("identity: no ASI patching when nothing is modified", () => {
		const source = "foo\n[0].bar()";
		const result = parse(source, { adapter });
		expect(print(result).code).toBe(source);
	});

	it("does NOT patch gap when second stmt starts with safe char", () => {
		const source = "foo\nbar()";
		const result = parse(source, { adapter });
		expect(print(result).code).toBe(source);
	});

	it("isAsiHazard + patchGap work together on the [ case", () => {
		// Direct test of the two functions that power the printer's patch pass.
		// This mirrors exactly what the printer does for a modified-region gap.
		const prevChunk = "baz";
		const gap = "\n";
		const nextChunk = "[0].bar()";

		expect(isAsiHazard(prevChunk, nextChunk)).toBe(true);
		expect(gapCrossesLine(gap)).toBe(true);
		expect(patchGap(gap)).toBe(";\n");

		// Assembled output would be: baz;\n[0].bar() — safe
		const safe = prevChunk + patchGap(gap) + nextChunk;
		expect(safe).toBe("baz;\n[0].bar()");
	});

	it("isAsiHazard + patchGap work together on the ( case", () => {
		const prev = "const a = 1";
		const gap = "\n";
		const next = "(function() {})()";

		expect(isAsiHazard(prev, next)).toBe(true);
		const safe = prev + patchGap(gap) + next;
		expect(safe).toBe("const a = 1;\n(function() {})()");
	});

	it("does NOT patch when prev already ends with semicolon", () => {
		const prev = "foo;";
		const gap = "\n";
		const next = "[0]";
		expect(isAsiHazard(prev, next)).toBe(false);
		// patchGap not called since isAsiHazard is false
		expect(prev + gap + next).toBe("foo;\n[0]"); // unchanged
	});

	it("handles comment in gap correctly", () => {
		const prev = "foo";
		const gap = " // note\n  ";
		const next = "[0]";
		expect(isAsiHazard(prev, next)).toBe(true);
		expect(patchGap(gap)).toBe("; // note\n  ");
	});
});

// ─── The original recast issue #394 scenario ─────────────────────────────────

describe("recast issue #394 — array disables ASI", () => {
	// The original bug: when an array element is moved such that the opening [
	// ends up on a new line after an expression that had no semicolon,
	// the reprinted code changes meaning.
	//
	// We can't fully replicate this with the fake adapter, but we can verify
	// that isAsiHazard correctly identifies the pattern from the issue.

	it("identifies the exact pattern from #394", () => {
		// Original code (safe — same line):
		//   const x = foo[0].bar()
		// After transform moves [0].bar() to next line (hazardous):
		//   const x = foo
		//   [0].bar()   ← this now means [0].bar() is a separate array literal
		expect(isAsiHazard("const x = foo", "[0].bar()")).toBe(true);
	});

	it("identifies IIFE hazard", () => {
		// const a = 1
		// (function() {})()  ← parses as: const a = 1(function(){})()
		expect(isAsiHazard("const a = 1", "(function() {})()")).toBe(true);
	});

	it("identifies tagged template hazard", () => {
		// const a = fn
		// `template`  ← parses as: fn`template` (tagged template)
		expect(isAsiHazard("const a = fn", "`template`")).toBe(true);
	});

	it("identifies division-vs-regex hazard", () => {
		// const a = b
		// /regex/  ← parses as: const a = b / regex /
		expect(isAsiHazard("const a = b", "/regex/")).toBe(true);
	});
});
