import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";

import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { applyAsync } from "../runtime/compile/apply";

describe("Handlebars-style Data Traversal", async () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Parent Context Access with ../", () => {
		test("should access parent scope in map", async () => {
			const rule = {
				map: [
					[1, 2, 3],
					{
						"+": [{ var: "" }, { var: "../multiplier" }],
					},
				],
			};

			const data = { multiplier: 10 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([11, 12, 13]);
		});

		test("should access nested parent scope", async () => {
			const rule = {
				map: [
					[
						{ items: [1, 2], offset: 50 },
						{ items: [3, 4], offset: 50 },
					],
					{
						map: [
							{ var: "items" },
							{
								"+": [{ var: "" }, { var: "../offset" }],
							},
						],
					},
				],
			};

			const data = { offset: 100 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([
				[51, 52],
				[53, 54],
			]);
		});

		test("should handle too many ../ gracefully", async () => {
			const rule = {
				map: [[1, 2, 3], { var: "../../../value" }],
			};

			const data = { value: 10 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([undefined, undefined, undefined]);
		});
	});

	describe("Iteration Metadata (@index, @first, @last)", () => {
		test("should access @index in map", async () => {
			const rule = {
				map: [["a", "b", "c"], { var: "@index" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([0, 1, 2]);
		});

		test("should access @first boolean", async () => {
			const rule = {
				map: [[1, 2, 3], { var: "@first" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([true, false, false]);
		});

		test("should access @last boolean", async () => {
			const rule = {
				map: [[1, 2, 3], { var: "@last" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([false, false, true]);
		});

		test("should access @total count", async () => {
			const rule = {
				map: [[1, 2, 3, 4, 5], { var: "@total" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([5, 5, 5, 5, 5]);
		});

		test("should use @index in calculations", async () => {
			const rule = {
				map: [
					[10, 20, 30],
					{
						"+": [{ var: "" }, { var: "@index" }],
					},
				],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([10, 21, 32]);
		});

		test("should use @first and @last in conditional logic", async () => {
			const rule = {
				map: [
					[1, 2, 3, 4, 5],
					{
						if: [
							{ var: "@first" },
							"FIRST",
							{
								if: [{ var: "@last" }, "LAST", "MIDDLE"],
							},
						],
					},
				],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual(["FIRST", "MIDDLE", "MIDDLE", "MIDDLE", "LAST"]);
		});
	});

	describe("Filter with parent context and metadata", () => {
		test("should filter using parent context", async () => {
			const rule = {
				filter: [
					[1, 2, 3, 4, 5],
					{ ">": [{ var: "" }, { var: "../threshold" }] },
				],
			};

			const data = { threshold: 3 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([4, 5]);
		});

		test("should filter using @index", async () => {
			const rule = {
				filter: [[10, 20, 30, 40, 50], { "<": [{ var: "@index" }, 3] }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([10, 20, 30]);
		});

		test("should filter using @first", async () => {
			const rule = {
				filter: [[10, 20, 30], { var: "@first" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([10]);
		});

		test("should filter using @last", async () => {
			const rule = {
				filter: [[10, 20, 30], { var: "@last" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([30]);
		});

		test("should combine @index with parent context", async () => {
			const rule = {
				filter: [
					[5, 10, 15, 20, 25],
					{
						and: [
							{ ">": [{ var: "" }, { var: "../minValue" }] },
							{ "<": [{ var: "@index" }, { var: "../maxIndex" }] },
						],
					},
				],
			};

			const data = { minValue: 8, maxIndex: 4 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([10, 15, 20]);
		});
	});

	describe("Complex nested scenarios", () => {
		test("should handle deeply nested iteration with parent access", async () => {
			const rule = {
				map: [
					[
						{ department: "Engineering", employees: ["Alice", "Bob"] },
						{ department: "Sales", employees: ["Charlie"] },
					],
					{
						map: [
							{ var: "employees" },
							{
								cat: [
									{ var: "" },
									{ cat: [" (", { var: "../department" }, ")"] },
								],
							},
						],
					},
				],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([
				["Alice (Engineering)", "Bob (Engineering)"],
				["Charlie (Sales)"],
			]);
		});

		test("should combine all features in a complex transformation", async () => {
			const rule = {
				map: [
					[10, 20, 30],
					{
						if: [
							{ var: "@first" },
							{ "+": [{ var: "" }, { var: "../bonus" }] },
							{ "*": [{ var: "" }, { var: "../multiplier" }] },
						],
					},
				],
			};

			const data = { bonus: 100, multiplier: 1.5 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([110, 30, 45]);
		});
	});
});
