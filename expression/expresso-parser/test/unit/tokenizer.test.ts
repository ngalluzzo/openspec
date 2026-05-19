import { describe, expect, it } from "bun:test";
import { TokenKind, tokenize } from "../../src/index";

describe("tokenizer", () => {
	describe("literals", () => {
		it("tokenizes numbers", () => {
			const tokens = tokenize("42");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Number,
				value: 42,
				start: 0,
				end: 2,
			});
		});

		it("tokenizes floats", () => {
			const tokens = tokenize("3.14");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Number,
				value: 3.14,
				start: 0,
				end: 4,
			});
		});

		it("tokenizes negative numbers in unary context", () => {
			const tokens = tokenize("(-5)");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.Number,
				value: -5,
				start: 1,
				end: 3,
			});
		});

		it("tokenizes strings with double quotes", () => {
			const tokens = tokenize('"hello"');
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.String,
				value: "hello",
				start: 0,
				end: 7,
			});
		});

		it("tokenizes strings with single quotes", () => {
			const tokens = tokenize("'world'");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.String,
				value: "world",
				start: 0,
				end: 7,
			});
		});

		it("handles escape sequences", () => {
			const tokens = tokenize('"hello\\nworld"');
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.String,
				value: "hello\nworld",
				start: 0,
				end: 14,
			});
		});

		it("tokenizes true", () => {
			const tokens = tokenize("true");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Bool,
				value: true,
				start: 0,
				end: 4,
			});
		});

		it("tokenizes false", () => {
			const tokens = tokenize("false");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Bool,
				value: false,
				start: 0,
				end: 5,
			});
		});

		it("tokenizes null", () => {
			const tokens = tokenize("null");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Null,
				value: null,
				start: 0,
				end: 4,
			});
		});
	});

	describe("identifiers and paths", () => {
		it("tokenizes simple identifiers", () => {
			const tokens = tokenize("user");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Identifier,
				value: "user",
				start: 0,
				end: 4,
			});
		});

		it("tokenizes dotted paths as single identifier", () => {
			const tokens = tokenize("user.age.name");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Identifier,
				value: "user.age.name",
				start: 0,
				end: 13,
			});
		});

		it("errors on keyword as path segment", () => {
			const result = tokenize("user.true.value");
			expect(result).toHaveProperty("code", "UNEXPECTED_CHAR");
		});

		it("tokenizes var keyword", () => {
			const tokens = tokenize("var");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.VarKeyword,
				value: "var",
				start: 0,
				end: 3,
			});
		});
	});

	describe("operators", () => {
		it("tokenizes ==", () => {
			const tokens = tokenize("a == b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.EqEq,
				value: "==",
				start: 2,
				end: 4,
			});
		});

		it("tokenizes ===", () => {
			const tokens = tokenize("a === b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.EqEqEq,
				value: "===",
				start: 2,
				end: 5,
			});
		});

		it("tokenizes !=", () => {
			const tokens = tokenize("a != b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.BangEq,
				value: "!=",
				start: 2,
				end: 4,
			});
		});

		it("tokenizes !==", () => {
			const tokens = tokenize("a !== b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.BangEqEq,
				value: "!==",
				start: 2,
				end: 5,
			});
		});

		it("tokenizes !", () => {
			const tokens = tokenize("!a");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.Bang,
				value: "!",
				start: 0,
				end: 1,
			});
		});

		it("tokenizes !!", () => {
			const tokens = tokenize("!!a");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.BangBang,
				value: "!!",
				start: 0,
				end: 2,
			});
		});

		it("tokenizes &&", () => {
			const tokens = tokenize("a && b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.AndAnd,
				value: "&&",
				start: 2,
				end: 4,
			});
		});

		it("tokenizes ||", () => {
			const tokens = tokenize("a || b");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.OrOr,
				value: "||",
				start: 2,
				end: 4,
			});
		});

		it("tokenizes =>", () => {
			const tokens = tokenize("x => x");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[1]).toEqual({
				kind: TokenKind.Arrow,
				value: "=>",
				start: 2,
				end: 4,
			});
		});
	});

	describe("punctuation", () => {
		it("tokenizes parens", () => {
			const tokens = tokenize("()");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.LParen,
				value: "(",
				start: 0,
				end: 1,
			});
			expect(tokens[1]).toEqual({
				kind: TokenKind.RParen,
				value: ")",
				start: 1,
				end: 2,
			});
		});

		it("tokenizes brackets", () => {
			const tokens = tokenize("[]");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.LBrack,
				value: "[",
				start: 0,
				end: 1,
			});
			expect(tokens[1]).toEqual({
				kind: TokenKind.RBrack,
				value: "]",
				start: 1,
				end: 2,
			});
		});

		it("tokenizes #{ }", () => {
			const tokens = tokenize("#{}");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.HashBrace,
				value: "#{",
				start: 0,
				end: 2,
			});
			expect(tokens[1]).toEqual({
				kind: TokenKind.RBrace,
				value: "}",
				start: 2,
				end: 3,
			});
		});

		it("tokenizes @data", () => {
			const tokens = tokenize("@data");
			expect(tokens).toBeInstanceOf(Array);
			if (!Array.isArray(tokens)) return;
			expect(tokens[0]).toEqual({
				kind: TokenKind.DataMarker,
				value: "@data",
				start: 0,
				end: 5,
			});
		});
	});

	describe("errors", () => {
		it("reports unterminated string", () => {
			const result = tokenize('"hello');
			expect(result).toHaveProperty("code", "UNTERMINATED_STRING");
		});

		it("reports unexpected character", () => {
			const result = tokenize("@x");
			expect(result).toHaveProperty("code", "UNEXPECTED_CHAR");
		});
	});
});
