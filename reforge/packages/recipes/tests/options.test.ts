import { describe, expect, it } from "bun:test";
import { RecipeOptionsError, resolveOptions } from "../src/options.js";

describe("resolveOptions", () => {
	it("returns empty object when no schema", () => {
		expect(resolveOptions(undefined, undefined, "test")).toEqual({});
	});

	it("applies defaults for missing optional fields", () => {
		const schema = {
			count: { type: "number" as const, description: "count", default: 5 },
		};
		const result = resolveOptions(schema, {}, "test");
		expect(result.count).toBe(5);
	});

	it("throws for missing required field", () => {
		const schema = {
			name: { type: "string" as const, description: "name", required: true },
		};
		expect(() => resolveOptions(schema, {}, "test/recipe")).toThrow(
			RecipeOptionsError,
		);
		expect(() => resolveOptions(schema, {}, "test/recipe")).toThrow(
			/name.*missing/i,
		);
	});

	it("passes provided values through", () => {
		const schema = {
			from: { type: "string" as const, description: "from", required: true },
			to: { type: "string" as const, description: "to", required: true },
		};
		const result = resolveOptions(
			schema,
			{ from: "lodash", to: "lodash-es" },
			"test",
		);
		expect(result).toEqual({ from: "lodash", to: "lodash-es" });
	});

	it("throws for wrong type", () => {
		const schema = {
			count: { type: "number" as const, description: "count", required: true },
		};
		expect(() =>
			resolveOptions(schema, { count: "not-a-number" }, "test"),
		).toThrow(/number/);
	});

	it("validates string[] type", () => {
		const schema = {
			tags: { type: "string[]" as const, description: "tags", required: true },
		};
		expect(resolveOptions(schema, { tags: ["a", "b"] }, "test").tags).toEqual([
			"a",
			"b",
		]);
		expect(() => resolveOptions(schema, { tags: "not-array" }, "test")).toThrow(
			/string\[\]/,
		);
	});

	it("runs custom validator", () => {
		const schema = {
			port: {
				type: "number" as const,
				description: "port",
				required: true,
				validate: (v: unknown) => {
					if ((v as number) < 1 || (v as number) > 65535)
						throw new Error("port out of range");
				},
			},
		};
		expect(() => resolveOptions(schema, { port: 99999 }, "test")).toThrow(
			/port out of range/,
		);
		expect(resolveOptions(schema, { port: 3000 }, "test").port).toBe(3000);
	});

	it("error includes recipe name", () => {
		const schema = {
			x: { type: "string" as const, description: "x", required: true },
		};
		expect(() => resolveOptions(schema, {}, "org.mine/my-recipe")).toThrow(
			"org.mine/my-recipe",
		);
	});
});
