import { describe, expect, it } from "bun:test";
import { parseExpression } from "../../src/index";

describe("parser", () => {
	describe("precedence", () => {
		it("respects || / && precedence", () => {
			const result = parseExpression("a && b || c");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				or: [{ and: [{ var: "a" }, { var: "b" }] }, { var: "c" }],
			});
		});

		it("respects comparison precedence", () => {
			const result = parseExpression("a + b > c");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				">": [{ "+": [{ var: "a" }, { var: "b" }] }, { var: "c" }],
			});
		});

		it("respects * / precedence over + -", () => {
			const result = parseExpression("a + b * c");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				"+": [{ var: "a" }, { "*": [{ var: "b" }, { var: "c" }] }],
			});
		});

		it("handles parenthesized expressions", () => {
			const result = parseExpression("(a + b) * c");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				"*": [{ "+": [{ var: "a" }, { var: "b" }] }, { var: "c" }],
			});
		});
	});

	describe("primary expressions", () => {
		it("parses numbers", () => {
			const result = parseExpression("42");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toBe(42);
		});

		it("parses strings", () => {
			const result = parseExpression('"hello"');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toBe("hello");
		});

		it("parses true", () => {
			const result = parseExpression("true");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toBe(true);
		});

		it("parses identifiers as var", () => {
			const result = parseExpression("user.age");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ var: "user.age" });
		});
	});

	describe("unary expressions", () => {
		it("parses ! operator", () => {
			const result = parseExpression("!active");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ "!": [{ var: "active" }] });
		});

		it("parses !! operator", () => {
			const result = parseExpression("!!value");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ "!!": [{ var: "value" }] });
		});
	});

	describe("function calls", () => {
		it("parses simple call", () => {
			const result = parseExpression('cat("Hello ", name)');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ cat: ["Hello ", { var: "name" }] });
		});

		it("parses if expression", () => {
			const result = parseExpression('if(x > 0, "pos","neg")');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				if: [{ ">": [{ var: "x" }, 0] }, "pos", "neg"],
			});
		});
	});

	describe("lambda expressions", () => {
		it("parses single param lambda", () => {
			const result = parseExpression("map(items, item => item.price)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				map: [{ var: "items" }, { var: "price" }],
			});
		});

		it("parses two param lambda for reduce", () => {
			const result = parseExpression("reduce(nums, (acc, n) => acc + n, 0)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				reduce: [
					{ var: "nums" },
					{ "+": [{ var: "accumulator" }, { var: "current" }] },
					0,
				],
			});
		});

		it("parses filter with lambda", () => {
			const result = parseExpression("filter(items, item => item.active)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				filter: [{ var: "items" }, { var: "active" }],
			});
		});
	});

	describe("var call", () => {
		it("parses explicit var()", () => {
			const result = parseExpression('var("../parent")');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ var: "../parent" });
		});
	});

	describe("@data literal", () => {
		it("parses @data with object", () => {
			const result = parseExpression('@data(#{ key: "value" })');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ "@data": { key: "value" } });
		});
	});

	describe("array literals", () => {
		it("parses empty array", () => {
			const result = parseExpression("[]");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual([]);
		});

		it("parses array with elements", () => {
			const result = parseExpression("[1, 2, 3]");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual([1, 2, 3]);
		});

		it("parses array with expressions", () => {
			const result = parseExpression("[user.name, user.age]");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual([{ var: "user.name" }, { var: "user.age" }]);
		});
	});

	describe("object literals", () => {
		it("parses empty object", () => {
			const result = parseExpression("#{}");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({});
		});

		it("parses object with entries", () => {
			const result = parseExpression('#{ name: "John", age: 30 }');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ name: "John", age: 30 });
		});

		it("parses object with expression values", () => {
			const result = parseExpression("#{ name: user.name }");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ name: { var: "user.name" } });
		});

		it("parses object with string keys", () => {
			const result = parseExpression('#{ "full name": user.name }');
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({ "full name": { var: "user.name" } });
		});
	});
});
