import type { BoundRecipe, Recipe, RecipeRef } from "./types.js";

export interface PlannedStep {
	recipe: Recipe<any>;
	options: Partial<Record<string, unknown>>;
}

/**
 * Resolve a list of RecipeRef entries (top-level recipes + their precipes)
 * into an ordered execution plan with no duplicates.
 *
 * Deduplication is by recipe.name — if the same recipe appears multiple
 * times (directly or via precipes), it runs once with the options from its
 * first appearance.
 *
 * Order guarantee: precipes always run before the recipe that declared them
 * (depth-first, post-order — children before parents).
 */
export function buildPlan(recipes: RecipeRef[]): PlannedStep[] {
	const seen = new Set<string>();
	const ordered: PlannedStep[] = [];

	function visit(ref: RecipeRef): void {
		const { recipe, options } = normalise(ref);

		// Recurse into precipes first (depth-first)
		for (const pre of recipe.precipes ?? []) {
			visit(pre);
		}

		// Add this recipe if not already seen
		if (!seen.has(recipe.name)) {
			seen.add(recipe.name);
			ordered.push({ recipe, options });
		}
	}

	for (const ref of recipes) {
		visit(ref);
	}

	return ordered;
}

/**
 * Detect cycles in the dependency graph.
 * Returns the cycle path as a string, or null if clean.
 */
export function detectCycle(recipes: RecipeRef[]): string | null {
	const visiting = new Set<string>();

	function visit(ref: RecipeRef, path: string[]): string | null {
		const { recipe } = normalise(ref);
		if (visiting.has(recipe.name)) {
			return [...path, recipe.name].join(" → ");
		}
		visiting.add(recipe.name);
		for (const pre of recipe.precipes ?? []) {
			const cycle = visit(pre, [...path, recipe.name]);
			if (cycle) return cycle;
		}
		visiting.delete(recipe.name);
		return null;
	}

	for (const ref of recipes) {
		const cycle = visit(ref, []);
		if (cycle) return cycle;
	}
	return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(ref: RecipeRef): {
	recipe: Recipe<any>;
	options: Record<string, unknown>;
} {
	if (isBoundRecipe(ref)) {
		return { recipe: ref.recipe, options: ref.options ?? {} };
	}
	return { recipe: ref, options: {} };
}

function isBoundRecipe(ref: RecipeRef): ref is BoundRecipe<any> {
	return (
		"recipe" in ref &&
		"options" in ref &&
		typeof (ref as { run?: unknown }).run !== "function"
	);
}
