import { describe, expect, it } from "bun:test";
import { parseExpression } from "../../src/index";

describe("lambda scoping", () => {
	describe("map/filter", () => {
		it("rewrites lambda param to empty var", () => {
			const result = parseExpression("map(items, item => item.price)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				map: [{ var: "items" }, { var: "price" }],
			});
		});

		it("rewrites nested property access", () => {
			const result = parseExpression("map(items, item => item.details.price)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				map: [{ var: "items" }, { var: "details.price" }],
			});
		});

		it("adds ../ prefix for outer scope access", () => {
			const result = parseExpression("map(items, item => user.name)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				map: [{ var: "items" }, { var: "../user.name" }],
			});
		});

		it("handles nested map/filter", () => {
			const result = parseExpression(
				"map(outer, o => map(inner, i => o.id + i.id))",
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				map: [
					{ var: "outer" },
					{
						map: [
							{ var: "../inner" },
							{
								"+": [{ var: "../../o.id" }, { var: "id" }],
							},
						],
					},
				],
			});
		});

		it("handles item references like item => item", () => {
			const result = parseExpression("filter(items, item => item)");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				filter: [{ var: "items" }, { var: "" }],
			});
		});
	});

	describe("reduce", () => {
		it("maps first param to accumulator", () => {
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

		it("maps second param to current", () => {
			const result = parseExpression("reduce(items, (acc, i) => i.value, [])");
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				reduce: [{ var: "items" }, { var: "current.value" }, []],
			});
		});

		it("allows var() to bypass reduce restriction", () => {
			const result = parseExpression(
				'reduce(items, (acc, i) => var("outer.value") + i.value, 0)',
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.rule).toEqual({
				reduce: [
					{ var: "items" },
					{ "+": [{ var: "outer.value" }, { var: "current.value" }] },
					0,
				],
			});
		});

		it("errors on outer var access in reduce", () => {
			const result = parseExpression(
				"reduce(items, (acc, i) => outer.value, 0)",
			);
			expect(result.ok).toBe(false);
			if (result.ok) return;
			expect(result.error.code).toBe("OUTER_VAR_IN_REDUCE");
		});
	});
});
