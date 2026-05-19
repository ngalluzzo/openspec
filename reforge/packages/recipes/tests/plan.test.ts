import { describe, expect, it } from "bun:test";
import type { RecipeRef } from "../src/types.js";
import { defineRecipe } from "../src/define.js";
import { buildPlan, detectCycle } from "../src/plan.js";

const noop = () => {};
function makeRecipe(name: string, precipes?: RecipeRef[]) {
	const def: {
		name: string;
		displayName: string;
		description: string;
		run: () => void;
		precipes?: RecipeRef[];
	} = {
		name,
		displayName: name,
		description: name,
		run: noop,
	};
	if (precipes !== undefined) {
		def.precipes = precipes;
	}
	return defineRecipe(def);
}
const make = makeRecipe;

describe("buildPlan", () => {
	it("returns single recipe with no precipes", () => {
		const r = make("a");
		const plan = buildPlan([r]);
		expect(plan).toHaveLength(1);
		expect(plan[0]?.recipe.name).toBe("a");
	});

	it("puts precipes before dependent recipe", () => {
		const a = make("a");
		const b = make("b", [a]);
		const plan = buildPlan([b]);
		expect(plan.map((s) => s.recipe.name)).toEqual(["a", "b"]);
	});

	it("deduplicates recipes across multiple dependents", () => {
		const shared = make("shared");
		const a = make("a", [shared]);
		const b = make("b", [shared]);
		const root = make("root", [a, b]);
		const plan = buildPlan([root]);
		const names = plan.map((s) => s.recipe.name);
		// shared should appear once
		expect(names.filter((n) => n === "shared")).toHaveLength(1);
		// order: shared before a and b, a and b before root
		expect(names.indexOf("shared")).toBeLessThan(names.indexOf("a"));
		expect(names.indexOf("shared")).toBeLessThan(names.indexOf("b"));
		expect(names.indexOf("a")).toBeLessThan(names.indexOf("root"));
		expect(names.indexOf("b")).toBeLessThan(names.indexOf("root"));
	});

	it("handles multiple top-level recipes", () => {
		const a = make("a");
		const b = make("b");
		const plan = buildPlan([a, b]);
		expect(plan.map((s) => s.recipe.name)).toEqual(["a", "b"]);
	});

	it("passes bound options through to the step", () => {
		const r = defineRecipe<{ x: string }>({
			name: "r",
			displayName: "r",
			description: "r",
			options: { x: { type: "string", description: "x", required: true } },
			run: noop,
		});
		const plan = buildPlan([r.with({ x: "hello" })]);
		expect(plan[0]?.options).toEqual({ x: "hello" });
	});

	it("empty input returns empty plan", () => {
		expect(buildPlan([])).toHaveLength(0);
	});
});

describe("detectCycle", () => {
	it("returns null for acyclic graph", () => {
		const a = make("a");
		const b = make("b", [a]);
		expect(detectCycle([b])).toBeNull();
	});

	it("detects a direct self-cycle", () => {
		// Build manually to bypass validation
		const r: any = {
			name: "self",
			displayName: "s",
			description: "s",
			run: noop,
		};
		r.precipes = [r];
		r.with = () => ({ recipe: r, options: {} });
		const cycle = detectCycle([r]);
		expect(cycle).not.toBeNull();
		expect(cycle).toContain("self");
	});

	it("detects an indirect cycle A → B → A", () => {
		const a: any = { name: "a", displayName: "a", description: "a", run: noop };
		const b: any = { name: "b", displayName: "b", description: "b", run: noop };
		a.precipes = [b];
		b.precipes = [a];
		a.with = () => ({ recipe: a, options: {} });
		b.with = () => ({ recipe: b, options: {} });
		const cycle = detectCycle([a]);
		expect(cycle).not.toBeNull();
	});
});
