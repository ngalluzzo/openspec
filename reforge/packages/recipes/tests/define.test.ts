import { describe, expect, it } from "bun:test";
import { defineRecipe } from "../src/define.js";

const minimal = {
	name: "test/minimal",
	displayName: "Minimal",
	description: "A minimal recipe for testing",
	run: () => {},
};

describe("defineRecipe", () => {
	it("creates a recipe with required fields", () => {
		const r = defineRecipe(minimal);
		expect(r.name).toBe("test/minimal");
		expect(r.displayName).toBe("Minimal");
		expect(r.description).toBe("A minimal recipe for testing");
		expect(typeof r.run).toBe("function");
	});

	it("attaches .with() for composition", () => {
		const r = defineRecipe<{ from: string; to: string }>({
			...minimal,
			options: {
				from: { type: "string", description: "from", required: true },
				to: { type: "string", description: "to", required: true },
			},
		});
		const bound = r.with({ from: "lodash", to: "lodash-es" });
		expect(bound.recipe).toBe(r);
		expect(bound.options).toEqual({ from: "lodash", to: "lodash-es" });
	});

	it("preserves optional fields", () => {
		const r = defineRecipe({
			...minimal,
			tags: ["migration", "esm"],
			appliesTo: ({ source }) => source.includes("lodash"),
		});
		expect(r.tags).toEqual(["migration", "esm"]);
		expect(typeof r.appliesTo).toBe("function");
	});

	it("throws when name is missing", () => {
		expect(() => defineRecipe({ ...minimal, name: "" })).toThrow(/name/);
	});

	it("throws when displayName is missing", () => {
		expect(() => defineRecipe({ ...minimal, displayName: "" })).toThrow(
			/displayName/,
		);
	});

	it("throws when description is missing", () => {
		expect(() => defineRecipe({ ...minimal, description: "" })).toThrow(
			/description/,
		);
	});

	it("throws when run is not a function", () => {
		expect(() =>
			defineRecipe({ ...minimal, run: "not a function" as any }),
		).toThrow(/run/);
	});
});
