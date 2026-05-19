import { describe, expect, it } from "bun:test";
import {
	matchesSelector,
	parseSelector,
	SelectorParseError,
} from "../src/selector.js";

describe("parseSelector", () => {
	describe("valid selectors", () => {
		it("parses a bare type", () => {
			expect(parseSelector("FunctionDeclaration")).toEqual({
				type: "FunctionDeclaration",
				attrs: [],
			});
		});

		it("parses existence attribute", () => {
			expect(parseSelector("FunctionDeclaration[async]")).toEqual({
				type: "FunctionDeclaration",
				attrs: [{ kind: "exists", path: ["async"] }],
			});
		});

		it("parses equality attribute", () => {
			expect(parseSelector("CallExpression[callee.name=require]")).toEqual({
				type: "CallExpression",
				attrs: [{ kind: "eq", path: ["callee", "name"], value: "require" }],
			});
		});

		it("parses multiple attributes", () => {
			const result = parseSelector(
				"ImportDeclaration[moduleSpecifier=lodash][importKind=value]",
			);
			expect(result.type).toBe("ImportDeclaration");
			expect(result.attrs).toHaveLength(2);
			expect(result.attrs[0]).toEqual({
				kind: "eq",
				path: ["moduleSpecifier"],
				value: "lodash",
			});
			expect(result.attrs[1]).toEqual({
				kind: "eq",
				path: ["importKind"],
				value: "value",
			});
		});

		it("parses deeply nested attribute path", () => {
			expect(
				parseSelector("MemberExpression[object.property.name=foo]"),
			).toEqual({
				type: "MemberExpression",
				attrs: [
					{ kind: "eq", path: ["object", "property", "name"], value: "foo" },
				],
			});
		});

		it("handles whitespace around type", () => {
			expect(parseSelector("  Identifier  ")).toEqual({
				type: "Identifier",
				attrs: [],
			});
		});
	});

	describe("invalid selectors", () => {
		it("throws on empty selector", () => {
			expect(() => parseSelector("")).toThrow(SelectorParseError);
		});

		it("throws on missing type", () => {
			expect(() => parseSelector("[async]")).toThrow(SelectorParseError);
		});

		it("throws on unclosed bracket", () => {
			expect(() => parseSelector("Foo[async")).toThrow(SelectorParseError);
			expect(() => parseSelector("Foo[async")).toThrow(/Unclosed/);
		});

		it("throws on empty brackets", () => {
			expect(() => parseSelector("Foo[]")).toThrow(SelectorParseError);
		});

		it("throws on empty value", () => {
			expect(() => parseSelector("Foo[name=]")).toThrow(SelectorParseError);
		});

		it("throws on invalid type name", () => {
			expect(() => parseSelector("123Invalid")).toThrow(SelectorParseError);
		});

		it("throws on invalid attr path segment", () => {
			expect(() => parseSelector("Foo[123bad=val]")).toThrow(
				SelectorParseError,
			);
		});
	});
});

describe("matchesSelector", () => {
	const typeOf = (n: Record<string, unknown>) => n.type as string;

	it("matches on type alone", () => {
		const node = { type: "Identifier", name: "foo" };
		expect(matchesSelector(node, parseSelector("Identifier"), typeOf)).toBe(
			true,
		);
		expect(matchesSelector(node, parseSelector("CallExpression"), typeOf)).toBe(
			false,
		);
	});

	it("matches existence attribute — truthy value", () => {
		const node = { type: "FunctionDeclaration", async: true };
		expect(
			matchesSelector(
				node,
				parseSelector("FunctionDeclaration[async]"),
				typeOf,
			),
		).toBe(true);
	});

	it("rejects existence attribute — false value", () => {
		const node = { type: "FunctionDeclaration", async: false };
		expect(
			matchesSelector(
				node,
				parseSelector("FunctionDeclaration[async]"),
				typeOf,
			),
		).toBe(false);
	});

	it("rejects existence attribute — missing property", () => {
		const node = { type: "FunctionDeclaration" };
		expect(
			matchesSelector(
				node,
				parseSelector("FunctionDeclaration[async]"),
				typeOf,
			),
		).toBe(false);
	});

	it("matches equality attribute", () => {
		const node = { type: "CallExpression", callee: { name: "require" } };
		expect(
			matchesSelector(
				node,
				parseSelector("CallExpression[callee.name=require]"),
				typeOf,
			),
		).toBe(true);
	});

	it("rejects equality attribute — wrong value", () => {
		const node = { type: "CallExpression", callee: { name: "import" } };
		expect(
			matchesSelector(
				node,
				parseSelector("CallExpression[callee.name=require]"),
				typeOf,
			),
		).toBe(false);
	});

	it("matches multiple attributes — all must pass", () => {
		const node = {
			type: "ImportDeclaration",
			moduleSpecifier: "lodash",
			importKind: "value",
		};
		const sel = parseSelector(
			"ImportDeclaration[moduleSpecifier=lodash][importKind=value]",
		);
		expect(matchesSelector(node, sel, typeOf)).toBe(true);

		const node2 = { ...node, importKind: "type" };
		expect(matchesSelector(node2, sel, typeOf)).toBe(false);
	});

	it("coerces numbers to strings for equality", () => {
		const node = { type: "NumericLiteral", value: 42 };
		expect(
			matchesSelector(node, parseSelector("NumericLiteral[value=42]"), typeOf),
		).toBe(true);
	});

	it("returns false for missing nested path", () => {
		const node = { type: "CallExpression", callee: null };
		expect(
			matchesSelector(
				node,
				parseSelector("CallExpression[callee.name=foo]"),
				typeOf,
			),
		).toBe(false);
	});
});
