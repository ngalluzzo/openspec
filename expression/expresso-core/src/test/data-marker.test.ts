import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import {
	apply,
	applyAsync,
	applyAsyncDebug,
	applyDebug,
	compile,
	compileDebug,
} from "../runtime/compile/apply";

describe("@data Marker", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("Basic @data marker functionality", () => {
		test("should return data without evaluation", () => {
			const rule = { var: [{ "@data": "literal-string" }, "fallback"] };
			const result = apply(rule, {});
			expect(result).toBe("literal-string");
		});

		test("should return arrays as-is", async () => {
			const rule = { map: [{ "@data": [1, 2, 3] }, { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([1, 2, 3]);
		});

		test("should return objects as-is", () => {
			const rule = {
				merge_deep: [
					{ "@data": { key: "value" } },
					{ "@data": { another: "data" } },
				],
			};
			const result = apply(rule, {});
			expect(result).toEqual({
				key: "value",
				another: "data",
			});
		});

		test("should return nested structures as-is", () => {
			const rule = {
				"@data": [
					{ id: 1, name: "Alice" },
					{ id: 2, name: "Bob" },
				],
			};
			const result = apply(rule, {});
			expect(result).toEqual([
				{ id: 1, name: "Alice" },
				{ id: 2, name: "Bob" },
			]);
		});

		test("should handle null values", () => {
			const rule = { var: [{ "@data": null }, "fallback"] };
			const result = apply(rule, {});
			expect(result).toBeNull();
		});
	});

	describe("Schema validation", () => {
		test("should throw error for wrong key name", () => {
			const rule = { var: [{ data: "value" }] };
			expect(() => apply(rule, {})).toThrowError();
		});

		test("should throw error for multiple keys", () => {
			const rule = { var: [{ "@data": "value", other: "key" }] };
			expect(() => apply(rule, {})).toThrowError();
		});

		test("should throw error for single-key object that looks like Rule", () => {
			const rule = { var: [{ "@data": { var: "x" } }] };
			expect(() => apply(rule, {})).toThrowError("appears to be a Rule");
		});

		test("should allow multi-key objects", () => {
			const rule = { var: [{ "@data": { path: "x", type: "var" } }] };
			const result = apply(rule, {});
			expect(result).toEqual({ path: "x", type: "var" });
		});
	});

	describe("Use in different contexts", () => {
		test("should work in conditions", () => {
			const rule = {
				if: [{ "@data": false }, "then-branch", "else-branch"],
			};
			const result = apply(rule, {});
			expect(result).toBe("else-branch");
		});

		test("should work in array operators", async () => {
			const rule = {
				map: [{ "@data": [1, 2, 3] }, { "*": [{ var: "" }, 2] }],
			};
			const result = await applyAsync(rule, {});
			expect(result).toEqual([2, 4, 6]);
		});

		test("should work in object operators", () => {
			const rule = {
				merge_deep: [
					{ var: "userProfile" },
					{ "@data": { createdAt: "2024-01-01" } },
				],
			};
			const result = apply(rule, { userProfile: { name: "John" } });
			expect(result).toEqual({
				name: "John",
				createdAt: "2024-01-01",
			});
		});

		test("should work with var operator default", () => {
			const rule = { var: ["items", { "@data": [1, 2, 3] }] };
			const result = apply(rule, {});
			expect(result).toEqual([1, 2, 3]);
		});
	});

	describe("Edge cases", () => {
		test("should handle empty arrays", async () => {
			const rule = { map: [{ "@data": [] }, { var: "" }] };
			const result = await applyAsync(rule, {});
			expect(result).toEqual([]);
		});

		test("should handle deeply nested structures", () => {
			const rule = {
				"@data": {
					users: [
						{ id: 1, profile: { name: "Alice" } },
						{ id: 2, profile: { name: "Bob" } },
					],
					metadata: { version: "1.0" },
				},
			};
			const result = apply(rule, {});
			expect(result).toEqual({
				users: [
					{ id: 1, profile: { name: "Alice" } },
					{ id: 2, profile: { name: "Bob" } },
				],
				metadata: { version: "1.0" },
			});
		});

		test("should handle arrays with mixed types", () => {
			const rule = { "@data": [1, "string", true, null, 3.14] };
			const result = apply(rule, {});
			expect(result).toEqual([1, "string", true, null, 3.14]);
		});

		test("should work with in operator", () => {
			const rule = { in: ["a", { "@data": ["a", "b", "c"] }] };
			const result = apply(rule, {});
			expect(result).toBe(true);
		});
	});

	describe("Comparison with normal evaluation", () => {
		test("should differ from normal var evaluation", () => {
			const dataMarkerRule = { var: [{ "@data": "literal" }] };
			const normalRule = { var: "literal" };

			const dataMarkerResult = apply(dataMarkerRule, { literal: "test" });
			const normalResult = apply(normalRule, { literal: "test" });

			expect(dataMarkerResult).toBe("literal");
			expect(normalResult).toBe("test");
		});

		test("should differ from normal array evaluation", async () => {
			const dataMarkerRule = { map: [{ "@data": [1, 2, 3] }, { var: "" }] };
			const normalRule = { map: [[1, { var: "x" }, 3], { var: "" }] };

			const dataMarkerResult = await applyAsync(dataMarkerRule, {});
			const normalResult = await applyAsync(normalRule, { x: "value" });

			expect(dataMarkerResult).toEqual([1, 2, 3]);
			expect(normalResult).toEqual([1, { var: "x" }, 3]);
		});
	});

	describe("Debug tracing", () => {
		test("should appear in debug trace", async () => {
			const rule = {
				map: [{ "@data": [1, 2, 3] }, { "*": [{ var: "" }, 2] }],
			};
			const { result, trace } = await applyAsyncDebug(rule, {});

			expect(result).toEqual([2, 4, 6]);

			const dataMarkerTrace = trace.find((t) => t.operator === "@data");
			expect(dataMarkerTrace).toBeDefined();
			expect(dataMarkerTrace?.args).toEqual([[1, 2, 3]]);
			expect(dataMarkerTrace?.result).toEqual([1, 2, 3]);
			expect(dataMarkerTrace?.depth).toBe(1);
		});

		test("should show full data in trace", () => {
			const largeArray = Array.from({ length: 100 }, (_, i) => i);
			const rule = { map: [{ "@data": largeArray }, { var: "" }] };
			const { trace } = applyDebug(rule, {});

			const dataMarkerTrace = trace.find((t) => t.operator === "@data");
			expect(dataMarkerTrace?.args).toEqual([largeArray]);
			expect(dataMarkerTrace?.result).toEqual(largeArray);
		});
	});

	describe("JSON serialization", () => {
		test("should preserve @data marker in JSON", () => {
			const rule = {
				map: [{ "@data": [1, 2, 3] }, { "*": [{ var: "" }, 2] }],
			};

			const json = JSON.stringify(rule);
			const parsed = JSON.parse(json);

			const originalResult = apply(rule, {});
			const parsedResult = apply(parsed, {});

			expect(originalResult).toEqual(parsedResult);
		});

		test("should preserve nested @data markers", () => {
			const rule = {
				merge: [{ var: "data" }, { "@data": { nested: { deep: "value" } } }],
			};

			const json = JSON.stringify(rule);
			const parsed = JSON.parse(json);

			const originalResult = apply(rule, {});
			const parsedResult = apply(parsed, {});

			expect(originalResult).toEqual(parsedResult);
		});
	});

	describe("Compile support", () => {
		test("should work with compile function", () => {
			const rule = { var: [{ "@data": "literal" }] };
			const compiled = compile(rule);
			const result = compiled({});
			expect(result).toBe("literal");
		});

		test("should work with compileDebug function", async () => {
			const rule = {
				map: [{ "@data": [1, 2, 3] }, { "*": [{ var: "" }, 2] }],
			};
			const compiled = compileDebug(rule);
			const debugResult = compiled({});
			const result = await Promise.resolve(debugResult.result);

			expect(result).toEqual([2, 4, 6]);

			const dataMarkerTrace = debugResult.trace.find(
				(t) => t.operator === "@data",
			);
			expect(dataMarkerTrace).toBeDefined();
		});
	});
});
