import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";

import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply, applyAsync } from "../runtime/compile/apply";

describe("Handlebars-style Traversal Compatibility and Edge Cases", async () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Backward compatibility", () => {
		test("should still work with empty path for current element", async () => {
			const rule = {
				map: [[1, 2, 3], { "*": [{ var: "" }, 2] }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([2, 4, 6]);
		});

		test("should still work with dot notation for nested access", () => {
			const rule = { var: "user.name" };
			const data = { user: { name: "John" } };
			const result = apply(rule, data);
			expect(result).toBe("John");
		});

		test("should still work with default values", () => {
			const rule = { var: ["user.email", "default@example.com"] };
			const data = { user: { name: "John" } };
			const result = apply(rule, data);
			expect(result).toBe("default@example.com");
		});

		test("should still work with array indexing in var", () => {
			const rule = { var: "items.0" };
			const data = { items: ["first", "second"] };
			const result = apply(rule, data);
			expect(result).toBe("first");
		});
	});

	describe("Edge cases", () => {
		test("should handle empty arrays", async () => {
			const rule = {
				map: [[], { "+": [{ var: "" }, { var: "../offset" }] }],
			};

			const data = { offset: 10 };
			const result = await applyAsync(rule, data);
			expect(result).toEqual([]);
		});

		test("should return undefined for unknown @ variables", async () => {
			const rule = {
				map: [[1, 2, 3], { var: "@unknown" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([undefined, undefined, undefined]);
		});

		test("should handle filter on empty array", async () => {
			const rule = {
				filter: [[], { var: "@first" }],
			};

			const data = {};
			const result = await applyAsync(rule, data);
			expect(result).toEqual([]);
		});
	});
});
