import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply } from "../runtime/compile/apply";

describe("Truthiness Modes - Default and JsonLogic", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Default Mode (JavaScript semantics)", () => {
		test("! operator with different types", () => {
			expect(apply({ "!": [false] }, {}, { truthinessMode: "default" })).toBe(
				true,
			);
			expect(apply({ "!": [true] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
			expect(apply({ "!": [0] }, {}, { truthinessMode: "default" })).toBe(true);
			expect(apply({ "!": [1] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
			expect(apply({ "!": [""] }, {}, { truthinessMode: "default" })).toBe(
				true,
			);
			expect(apply({ "!": ["hello"] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
			expect(apply({ "!": [null] }, {}, { truthinessMode: "default" })).toBe(
				true,
			);
			expect(apply({ "!": [NaN] }, {}, { truthinessMode: "default" })).toBe(
				true,
			);
		});

		test("! operator with arrays (all arrays are truthy)", () => {
			expect(apply({ "!": [[]] }, {}, { truthinessMode: "default" })).toBe(
				false,
			);
			expect(
				apply({ "!": [[1, 2, 3]] }, {}, { truthinessMode: "default" }),
			).toBe(false);
		});

		test("! operator with objects (all objects are truthy)", () => {
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: {} },
					{ truthinessMode: "default" },
				),
			).toBe(false);
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: { a: 1 } },
					{ truthinessMode: "default" },
				),
			).toBe(false);
		});

		test("or operator with short-circuit", () => {
			expect(
				apply({ or: [false, 0, ""] }, {}, { truthinessMode: "default" }),
			).toBe("");
			expect(
				apply({ or: [false, true, ""] }, {}, { truthinessMode: "default" }),
			).toBe(true);
			expect(
				apply({ or: ["hello", false] }, {}, { truthinessMode: "default" }),
			).toBe("hello");
		});

		test("and operator with short-circuit", () => {
			expect(
				apply({ and: [true, 1, "hello"] }, {}, { truthinessMode: "default" }),
			).toBe("hello");
			expect(
				apply(
					{ and: [true, false, "hello"] },
					{},
					{ truthinessMode: "default" },
				),
			).toBe(false);
			expect(
				apply({ and: [true, 0, "hello"] }, {}, { truthinessMode: "default" }),
			).toBe(0);
		});

		test("if operator with truthy conditions", () => {
			expect(
				apply({ if: [1, "yes", "no"] }, {}, { truthinessMode: "default" }),
			).toBe("yes");
			expect(
				apply({ if: [0, "yes", "no"] }, {}, { truthinessMode: "default" }),
			).toBe("no");
			expect(
				apply(
					{ if: ["hello", "yes", "no"] },
					{},
					{ truthinessMode: "default" },
				),
			).toBe("yes");
			expect(
				apply({ if: ["", "yes", "no"] }, {}, { truthinessMode: "default" }),
			).toBe("no");
		});

		test("if operator with array conditions", () => {
			expect(
				apply({ if: [[], "yes", "no"] }, {}, { truthinessMode: "default" }),
			).toBe("yes");
			expect(
				apply({ if: [[1, 2], "yes", "no"] }, {}, { truthinessMode: "default" }),
			).toBe("yes");
		});

		test("if operator with object conditions", () => {
			expect(
				apply(
					{ if: [{ var: "obj" }, "yes", "no"] },
					{ obj: {} },
					{ truthinessMode: "default" },
				),
			).toBe("yes");
			expect(
				apply(
					{ if: [{ var: "obj" }, "yes", "no"] },
					{ obj: { a: 1 } },
					{ truthinessMode: "default" },
				),
			).toBe("yes");
		});
	});

	describe("JsonLogic Mode", () => {
		test("! operator with different types", () => {
			expect(apply({ "!": [false] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				true,
			);
			expect(apply({ "!": [true] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				false,
			);
			expect(apply({ "!": [0] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				true,
			);
			expect(apply({ "!": [1] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				false,
			);
			expect(apply({ "!": [""] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				true,
			);
			expect(
				apply({ "!": ["hello"] }, {}, { truthinessMode: "jsonlogic" }),
			).toBe(false);
			expect(apply({ "!": [null] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				true,
			);
		});

		test("! operator with arrays", () => {
			expect(apply({ "!": [[]] }, {}, { truthinessMode: "jsonlogic" })).toBe(
				false,
			);
			expect(
				apply({ "!": [[1, 2, 3]] }, {}, { truthinessMode: "jsonlogic" }),
			).toBe(false);
		});

		test("! operator with objects", () => {
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: {} },
					{ truthinessMode: "jsonlogic" },
				),
			).toBe(false);
			expect(
				apply(
					{ "!": [{ var: "obj" }] },
					{ obj: { a: 1 } },
					{ truthinessMode: "jsonlogic" },
				),
			).toBe(false);
		});
	});
});
