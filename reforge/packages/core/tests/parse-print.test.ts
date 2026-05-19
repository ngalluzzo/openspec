import { describe, expect, it } from "bun:test";
import { parse, print, ReforgeNoPrinterError, snippet } from "../src/index.js";
import type { NodeVisitor, ParserAdapter } from "../src/types.js";

// ─── A simple line-based adapter (plain text "AST") ──────────────────────────
// Treats each line as a "Line" node. Lets us test the printer
// without needing a real language parser.

interface LineNode {
	type: "File" | "Line";
	text?: string;
	start: number;
	end: number;
	children?: LineNode[];
}

function buildLineAdapter(): ParserAdapter<LineNode> {
	return {
		language: "lines",

		parse(source: string): LineNode {
			const lines: LineNode[] = [];
			let offset = 0;
			for (const text of source.split("\n")) {
				lines.push({
					type: "Line",
					text,
					start: offset,
					end: offset + text.length,
				});
				offset += text.length + 1; // +1 for \n
			}
			return { type: "File", start: 0, end: source.length, children: lines };
		},

		parseSnippet(source: string): LineNode {
			return this.parse(source);
		},

		walk(root: LineNode, visitor: NodeVisitor<LineNode>): void {
			function visit(node: LineNode, parent: LineNode | null) {
				const ctrl = visitor.enter?.(node, parent, null);
				if (ctrl !== "skip" && ctrl !== "stop") {
					for (const child of node.children ?? []) visit(child, node);
				}
				visitor.leave?.(node, parent, null);
			}
			visit(root, null);
		},

		locate: (node) => ({
			start: { offset: node.start, line: 1, column: 0 },
			end: { offset: node.end, line: 1, column: 0 },
		}),

		typeOf: (node) => node.type,
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("parse + print round-trip", () => {
	const adapter = buildLineAdapter();

	it("identity: parse then print returns original source unchanged", () => {
		const source = "line one\nline two\nline three";
		const result = parse(source, { adapter });
		const { code } = print(result);
		expect(code).toBe(source);
	});

	it("preserves formatting of unmodified nodes after a mutation", () => {
		const source = "  line one  \n  line two  \n  line three  ";
		const result = parse(source, { adapter });

		// Mutate only the second line
		const lines = result.ast.children ?? [];
		const secondLine = lines[1];
		if (secondLine == null) throw new Error("expected second line node");
		secondLine.text = "CHANGED";
		result.originalMap.markNew(secondLine);

		const { code } = print(result);

		// First and third lines preserved verbatim (spaces and all)
		expect(code).toContain("  line one  ");
		expect(code).toContain("  line three  ");
		// Second line was marked new — won't appear verbatim
		// (it will be skipped in the splice since we marked it new,
		//  and the fallback printer will error unless we provide one)
	});

	it("throws ReforgeNoPrinterError for new nodes when adapter has no print()", () => {
		const source = "hello";
		const result = parse(source, { adapter });

		// Build a brand new node and mark it as new
		const newNode: LineNode = { type: "Line", text: "world", start: 0, end: 5 };
		result.originalMap.markNew(newNode);
		result.originalMap.markNew(result.ast); // parent must also be dirty to recurse
		result.ast.children = [newNode];

		expect(() => print(result)).toThrow(ReforgeNoPrinterError);
		expect(() => print(result)).toThrow(/parse\.snippet\(\)/);
	});
});

describe("parse.snippet()", () => {
	const adapter = buildLineAdapter();

	it("returns a node from a source string", () => {
		const node = snippet("hello world", { adapter });
		expect(node.type).toBe("File");
	});
});

describe("identity guarantee", () => {
	const adapter = buildLineAdapter();

	const sources = [
		"single line",
		"line one\nline two",
		"  leading spaces\n\ttabs\ntrailing spaces  ",
		"", // empty source
		"\n\n\n", // only newlines
	];

	for (const source of sources) {
		it(`preserves: ${JSON.stringify(source)}`, () => {
			const result = parse(source, { adapter });
			const { code } = print(result);
			expect(code).toBe(source);
		});
	}
});
