import type { BoundRecipe, Recipe } from "./types.js";

/**
 * Define a recipe — the primary authoring API for @reforge/recipes.
 *
 * Returns a plain object satisfying the Recipe interface, with a `.with()`
 * method added for use in `precipes` composition arrays.
 *
 * @example
 * export const myRecipe = defineRecipe({
 *   name: "org.mine/my-recipe",
 *   displayName: "My recipe",
 *   description: "Does something useful",
 *   run({ query, report }) {
 *     query.find("ImportDeclaration").mutate(p => {
 *       report.change("Updated import");
 *     });
 *   },
 * });
 */
export function defineRecipe<
	TOptions extends Record<string, unknown> = Record<string, never>,
>(def: Omit<Recipe<TOptions>, "with">): Recipe<TOptions> {
	// Validate required fields
	if (!def.name?.trim()) throw new Error("defineRecipe: name is required");
	if (!def.displayName?.trim())
		throw new Error("defineRecipe: displayName is required");
	if (!def.description?.trim())
		throw new Error("defineRecipe: description is required");
	if (typeof def.run !== "function")
		throw new Error("defineRecipe: run must be a function");

	const recipe: Recipe<TOptions> = {
		...def,
		with(boundOptions: Partial<TOptions>): BoundRecipe<TOptions> {
			return { recipe, options: boundOptions };
		},
	};

	return recipe;
}
