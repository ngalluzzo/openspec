import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply, applyAsync } from "../runtime/compile/apply";
import { isStaticArray } from "../runtime/shared/utils";

describe("Static Array Optimization", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("isStaticArray utility", () => {
		test("should identify arrays of primitives as static", () => {
			expect(isStaticArray([1, 2, 3])).toBe(true);
			expect(isStaticArray(["a", "b", "c"])).toBe(true);
			expect(isStaticArray([true, false, true])).toBe(true);
			expect(isStaticArray([null, null, null])).toBe(true);
			expect(isStaticArray([1, "a", true, null])).toBe(true);
			expect(isStaticArray([])).toBe(true);
		});

		test("should identify arrays with rules as not static", () => {
			expect(isStaticArray([{ var: "x" }])).toBe(false);
			expect(isStaticArray([{ "==": [1, 2] }])).toBe(false);
			expect(isStaticArray([1, { var: "x" }, 3])).toBe(false);
			expect(
				isStaticArray([
					[1, 2],
					[3, 4],
				]),
			).toBe(false);
			expect(isStaticArray([{ key: "value" }])).toBe(false);
		});

		test("should identify non-arrays as not static", () => {
			expect(isStaticArray(1)).toBe(false);
			expect(isStaticArray("string")).toBe(false);
			expect(isStaticArray(true)).toBe(false);
			expect(isStaticArray(null)).toBe(false);
			expect(isStaticArray({ key: "value" })).toBe(false);
			expect(isStaticArray(undefined)).toBe(false);
		});
	});

	describe("Performance optimization with static arrays", () => {
		test("should optimize arrays of numbers", async () => {
			const rule = { map: [[1, 2, 3], { "*": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([2, 4, 6]);
		});

		test("should optimize arrays of strings", async () => {
			const rule = { map: [["a", "b", "c"], { cat: ["-", { var: "" }] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual(["-a", "-b", "-c"]);
		});

		test("should optimize arrays of booleans", async () => {
			const rule = { all: [[true, true, true], { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toBe(true);
		});

		test("should optimize arrays with mixed primitives", async () => {
			const rule = { map: [[1, "a", true], { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([1, "a", true]);
		});

		test("should optimize empty arrays", async () => {
			const rule = { all: [[], { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toBe(true);
		});

		test("should optimize large static arrays", async () => {
			const largeArray = Array.from({ length: 100 }, (_, i) => i);
			const rule = { map: [largeArray, { "*": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual(largeArray.map((n) => n * 2));
		});
	});

	describe("Arrays with mixed types are not optimized", () => {
		test("should pass through arrays containing rules to eager operators", async () => {
			const rule = { map: [[1, { var: "x" }, 3], { var: "" }] };
			const result = await applyAsync(rule, { x: 10 });
			expect(result).toEqual([1, { var: "x" }, 3]);
		});

		test("should pass through arrays containing objects to eager operators", async () => {
			const rule = { map: [[{ key: "value" }], { var: "key" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual(["value"]);
		});

		test("should pass through arrays containing nested arrays to eager operators", async () => {
			const rule = {
				map: [
					[
						[1, 2],
						[3, 4],
					],
					{ var: "0" },
				],
			};
			const result = await applyAsync(rule, {});
			expect(result).toEqual([1, 3]);
		});

		test("should pass through arrays with mixed primitives and rules to eager operators", async () => {
			const rule = {
				map: [[1, { var: "x" }, 3, { "+": [{ var: "y" }, 5] }], { var: "" }],
			};
			const result = await applyAsync(rule, { x: 10, y: 20 });
			expect(result).toEqual([1, { var: "x" }, 3, { "+": [{ var: "y" }, 5] }]);
		});
	});

	describe("Operators with static arrays", () => {
		test("in operator with static array", () => {
			const rule = { in: ["admin", ["admin", "user", "guest"]] };
			const result = apply(rule, {});
			expect(result).toBe(true);
		});

		test("map operator with static array", async () => {
			const rule = { map: [[1, 2, 3], { "*": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([2, 4, 6]);
		});

		test("filter operator with static array", async () => {
			const rule = { filter: [[1, 2, 3, 4, 5], { ">": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([3, 4, 5]);
		});

		test("all operator with static array", async () => {
			const rule = { all: [[1, 2, 3], { ">": [{ var: "" }, 0] }] };
			const result = await applyAsync(rule, {});
			expect(result).toBe(true);
		});

		test("some operator with static array", async () => {
			const rule = { some: [[-1, 0, 1], { ">": [{ var: "" }, 0] }] };
			const result = await applyAsync(rule, {});
			expect(result).toBe(true);
		});

		test("none operator with static array", async () => {
			const rule = { none: [[1, 2, 3], { "<": [{ var: "" }, 0] }] };
			const result = await applyAsync(rule, {});
			expect(result).toBe(true);
		});

		test("reduce operator with static array", async () => {
			const rule = {
				reduce: [
					[1, 2, 3],
					{ "+": [{ var: "accumulator" }, { var: "current" }] },
					0,
				],
			};
			const result = await applyAsync(rule, {});
			expect(result).toBe(6);
		});
	});

	describe("Async evaluation with static arrays", async () => {
		test("should optimize static arrays in async map", async () => {
			const rule = { map: [[1, 2, 3], { "*": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([2, 4, 6]);
		});

		test("should optimize static arrays in async filter", async () => {
			const rule = { filter: [[1, 2, 3, 4, 5], { ">": [{ var: "" }, 2] }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([3, 4, 5]);
		});

		test("should pass through mixed arrays in async map", async () => {
			const rule = { map: [[1, { var: "x" }, 3], { var: "" }] };
			const result = await applyAsync(rule, { x: 10 });
			expect(result).toEqual([1, { var: "x" }, 3]);
		});
	});

	describe("Edge cases", () => {
		test("should handle nested static arrays in rules", () => {
			const rule = {
				if: [{ in: ["value", ["a", "b", "c"]] }, "found", "not-found"],
			};
			const result = apply(rule, {});
			expect(result).toBe("not-found");
		});

		test("should handle static arrays in switch operator", () => {
			const rule = {
				switch: [
					{ "==": [{ var: "type" }, "a"] },
					"type-a",
					{ "==": [{ var: "type" }, "b"] },
					"type-b",
					"unknown",
				],
			};
			const result = apply(rule, { type: "a" });
			expect(result).toBe("type-a");
		});

		test("should handle static arrays with null values", async () => {
			const rule = { map: [[1, null, 3], { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([1, null, 3]);
		});

		test("should handle static arrays with boolean values", async () => {
			const rule = { map: [[true, false, true], { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([true, false, true]);
		});

		test("should optimize arrays in var operator with default", () => {
			const rule = { var: ["items", [1, 2, 3]] };
			const result = apply(rule, {});
			expect(result).toEqual([1, 2, 3]);
		});
	});

	describe("Performance benchmarks", () => {
		test("should have same results for static and dynamic arrays", async () => {
			const staticArray = Array.from({ length: 1000 }, (_, i) => i);
			const dynamicArrayRule = { var: "items" };

			const staticResult = await applyAsync(
				{ map: [staticArray, { "*": [{ var: "" }, 2] }] },
				{},
			);
			const dynamicResult = await applyAsync(
				{ map: [dynamicArrayRule, { "*": [{ var: "" }, 2] }] },
				{ items: staticArray },
			);

			expect(staticResult).toEqual(dynamicResult);
		});
	});
});
