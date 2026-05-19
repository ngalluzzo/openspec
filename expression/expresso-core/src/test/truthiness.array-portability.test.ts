import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply, applyAsync } from "../runtime/compile/apply";

describe("Truthiness Modes - Arrays and Portability", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Array Operators with Truthiness Modes", () => {
		describe("all operator", () => {
			test("all in default mode", async () => {
				const data = [1, 2, 3];
				const result = await applyAsync(
					{ all: [data, { "==": [{ var: "" }, 0] }] },
					{},
				);
				expect(result).toBe(false);
			});

			test("all in Python mode with empty arrays", async () => {
				const data = [[1, 2], [3], [4, 5]];
				const result = await applyAsync(
					{ all: [data, { var: "" }] },
					{},
					{ truthinessMode: "python" },
				);
				expect(result).toBe(true);
			});
		});

		describe("none operator", () => {
			test("none in default mode", async () => {
				const data = [1, 2, 3];
				const result = await applyAsync(
					{ none: [data, { "==": [{ var: "" }, 0] }] },
					{},
				);
				expect(result).toBe(true);
			});
		});

		describe("some operator", () => {
			test("some in default mode", async () => {
				const data = [0, 1, 0];
				const result = await applyAsync({ some: [data, { var: "" }] }, {});
				expect(result).toBe(true);
			});
		});

		describe("filter operator", () => {
			test("filter in default mode", async () => {
				const data = [0, 1, 2, 0, 3];
				const result = await applyAsync({ filter: [data, { var: "" }] }, {});
				expect(result).toEqual([1, 2, 3]);
			});

			test("filter in Python mode with empty arrays", async () => {
				const data = [[], [1], [], [2], []];
				const result = await applyAsync(
					{ filter: [data, { var: "" }] },
					{},
					{ truthinessMode: "python" },
				);
				expect(result).toEqual([[1], [2]]);
			});
		});
	});

	describe("Portability Scenarios", () => {
		test('{ "!": [0] } vs { "!": 0 } - Array vs Number', () => {
			expect(apply({ "!": [0] }, {}, { truthinessMode: "default" })).toBe(true);
			expect(apply({ "!": 0 }, {}, { truthinessMode: "default" })).toBe(true);
			expect(apply({ "!": [[]] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
		});

		test('{ "!": { "var": "data" } } where data is an array', () => {
			const data1 = { data: [] };
			const data2 = { data: [1, 2, 3] };
			const data3 = { data: [[]] };

			expect(
				apply({ "!": { var: "data" } }, data1, { truthinessMode: "default" }),
			).toBe(false);
			expect(
				apply({ "!": { var: "data" } }, data2, { truthinessMode: "default" }),
			).toBe(false);
			expect(
				apply({ "!": { var: "data" } }, data3, { truthinessMode: "default" }),
			).toBe(false);

			expect(
				apply({ "!": { var: "data" } }, data1, { truthinessMode: "python" }),
			).toBe(true);
			expect(
				apply({ "!": { var: "data" } }, data2, { truthinessMode: "python" }),
			).toBe(false);
		});

		test("Complex rule with nested conditions", () => {
			const rule = {
				if: [{ var: "items" }, "has-items", "no-items"],
			};

			const data1 = { items: [] };
			const data2 = { items: [1, 2, 3] };

			expect(apply(rule, data1, { truthinessMode: "default" })).toBe(
				"has-items",
			);
			expect(apply(rule, data2, { truthinessMode: "default" })).toBe(
				"has-items",
			);

			expect(apply(rule, data1, { truthinessMode: "python" })).toBe("no-items");
			expect(apply(rule, data2, { truthinessMode: "python" })).toBe(
				"has-items",
			);
		});
	});

	describe("!! Operator (Boolean Conversion)", () => {
		test("!! converts to boolean in all modes", () => {
			expect(apply({ "!!": [0] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
			expect(apply({ "!!": [0] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				false,
			);
			expect(apply({ "!!": [0] }, {}, { truthinessMode: "python" })).toBe(
				false,
			);
			expect(apply({ "!!": [0] }, {}, { truthinessMode: "strict" })).toBe(
				false,
			);

			expect(apply({ "!!": [[]] }, {}, { truthinessMode: "default" })).toBe(
				true,
			);
			expect(apply({ "!!": [[]] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				true,
			);
			expect(apply({ "!!": [[]] }, {}, { truthinessMode: "python" })).toBe(
				false,
			);
			expect(apply({ "!!": [[]] }, {}, { truthinessMode: "strict" })).toBe(
				false,
			);
		});
	});
});
