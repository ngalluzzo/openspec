import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply } from "../runtime/compile/apply";

describe("Truthiness Modes - Python and Strict", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Python Mode", () => {
		test("! operator with different types", () => {
			expect(apply({ "!": [false] }, {}, { truthinessMode: "python" })).toBe(
				true,
			);
			expect(apply({ "!": [true] }, {}, { truthinessMode: "python" })).toBe(
				false,
			);
			expect(apply({ "!": [0] }, {}, { truthinessMode: "python" })).toBe(true);
			expect(apply({ "!": [1] }, {}, { truthinessMode: "python" })).toBe(false);
			expect(apply({ "!": [0.0] }, {}, { truthinessMode: "python" })).toBe(
				true,
			);
			expect(apply({ "!": [""] }, {}, { truthinessMode: "python" })).toBe(true);
			expect(apply({ "!": ["hello"] }, {}, { truthinessMode: "python" })).toBe(
				false,
			);
			expect(apply({ "!": [null] }, {}, { truthinessMode: "python" })).toBe(
				true,
			);
			expect(apply({ "!": [NaN] }, {}, { truthinessMode: "python" })).toBe(
				true,
			);
		});

		test("! operator with empty arrays (falsy in Python)", () => {
			expect(apply({ "!": [[]] }, {}, { truthinessMode: "python" })).toBe(true);
			expect(
				apply({ "!": [[1, 2, 3]] }, {}, { truthinessMode: "python" }),
			).toBe(false);
		});

		test("! operator with empty objects (falsy in Python)", () => {
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: {} },
					{ truthinessMode: "python" },
				),
			).toBe(true);
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: { a: 1 } },
					{ truthinessMode: "python" },
				),
			).toBe(false);
		});

		test("if operator with array conditions in Python mode", () => {
			expect(
				apply({ if: [[], "yes", "no"] }, {}, { truthinessMode: "python" }),
			).toBe("no");
			expect(
				apply({ if: [[1, 2], "yes", "no"] }, {}, { truthinessMode: "python" }),
			).toBe("yes");
		});

		test("if operator with object conditions in Python mode", () => {
			expect(
				apply(
					{ if: [{ var: "obj" }, "yes", "no"] },
					{ obj: {} },
					{ truthinessMode: "python" },
				),
			).toBe("no");
			expect(
				apply(
					{ if: [{ var: "obj" }, "yes", "no"] },
					{ obj: { a: 1 } },
					{ truthinessMode: "python" },
				),
			).toBe("yes");
		});
	});

	describe("Strict Mode", () => {
		test("! operator only treats true as truthy", () => {
			expect(apply({ "!": [true] }, {}, { truthinessMode: "strict" })).toBe(
				false,
			);
			expect(apply({ "!": [false] }, {}, { truthinessMode: "strict" })).toBe(
				true,
			);
			expect(apply({ "!": [1] }, {}, { truthinessMode: "strict" })).toBe(true);
			expect(apply({ "!": [0] }, {}, { truthinessMode: "strict" })).toBe(true);
			expect(apply({ "!": ["hello"] }, {}, { truthinessMode: "strict" })).toBe(
				true,
			);
			expect(apply({ "!": [""] }, {}, { truthinessMode: "strict" })).toBe(true);
			expect(apply({ "!": [[]] }, {}, { truthinessMode: "strict" })).toBe(true);
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: {} },
					{ truthinessMode: "strict" },
				),
			).toBe(true);
			expect(apply({ "!": [null] }, {}, { truthinessMode: "strict" })).toBe(
				true,
			);
		});

		test("if operator only triggers on true in strict mode", () => {
			expect(
				apply({ if: [true, "yes", "no"] }, {}, { truthinessMode: "strict" }),
			).toBe("yes");
			expect(
				apply({ if: [1, "yes", "no"] }, {}, { truthinessMode: "strict" }),
			).toBe("no");
			expect(
				apply({ if: ["hello", "yes", "no"] }, {}, { truthinessMode: "strict" }),
			).toBe("no");
			expect(
				apply({ if: [false, "yes", "no"] }, {}, { truthinessMode: "strict" }),
			).toBe("no");
		});

		test("or operator in strict mode", () => {
			expect(
				apply({ or: [false, 0, ""] }, {}, { truthinessMode: "strict" }),
			).toBe("");
			expect(
				apply({ or: [false, true, ""] }, {}, { truthinessMode: "strict" }),
			).toBe(true);
			expect(
				apply({ or: [false, 1, ""] }, {}, { truthinessMode: "strict" }),
			).toBe("");
			expect(
				apply({ or: [false, "hello", ""] }, {}, { truthinessMode: "strict" }),
			).toBe("");
		});

		test("and operator in strict mode", () => {
			expect(
				apply({ and: [true, true, true] }, {}, { truthinessMode: "strict" }),
			).toBe(true);
			expect(
				apply({ and: [true, false, true] }, {}, { truthinessMode: "strict" }),
			).toBe(false);
			expect(
				apply({ and: [true, 1, true] }, {}, { truthinessMode: "strict" }),
			).toBe(1);
		});
	});
});
