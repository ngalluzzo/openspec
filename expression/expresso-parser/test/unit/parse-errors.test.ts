import { describe, expect, it } from "bun:test";
import { ParseError, parseExpression } from "../../src/index";

describe("parse errors", () => {
	it("returns error for unterminated string", () => {
		const result = parseExpression('"hello');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("UNTERMINATED_STRING");
	});

	it("returns error for unexpected character", () => {
		const result = parseExpression("@x");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("UNEXPECTED_CHAR");
	});

	it("returns error for unexpected token", () => {
		const result = parseExpression(")");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("UNEXPECTED_TOKEN");
	});

	it("returns error for missing closing paren", () => {
		const result = parseExpression("(a + b");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("UNEXPECTED_TOKEN");
	});

	it("returns error for too few args", () => {
		const result = parseExpression("if(true)");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe("TOO_FEW_ARGS");
	});

	it("format() includes location info", () => {
		const result = parseExpression('"hello');
		expect(result.ok).toBe(false);
		if (result.ok) return;
		const formatted = result.error.format();
		expect(formatted).toContain("line 1");
		expect(formatted).toContain("UNTERMINATED_STRING");
	});

	it("parseExpressionOrThrow throws on error", async () => {
		const { parseExpressionOrThrow } = await import("../../src/index");
		expect(() => parseExpressionOrThrow('"hello')).toThrow(ParseError);
	});
});
