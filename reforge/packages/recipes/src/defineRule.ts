import type {
	Rule,
	LintSeverity,
	LintContext,
	RecipeContext,
} from "./types.js";

/**
 * Define a lint rule — a named, reusable check with an optional fix recipe.
 *
 * Rules satisfy the Recipe interface and can be composed with other recipes
 * in precipes arrays, passed to runRecipes(), etc. When used as a recipe,
 * lint() diagnostics are forwarded to report.warn() / report.needsReview().
 *
 * When used as a rule in runRules(), diagnostics carry precise location info
 * and severity for editor integration and CI gating.
 *
 * @example
 * ```ts
 * export const noLodash = defineRule({
 *   name: "org.reforge/no-lodash",
 *   displayName: "No lodash",
 *   description: "Prefer lodash-es for tree-shaking",
 *   severity: "warning",
 *
 *   lint({ query }) {
 *     return query.find("ImportDeclaration[moduleSpecifier=lodash]")
 *       .map(p => ({ message: "Use lodash-es instead", path: p }));
 *   },
 *
 *   fix: lodashToEs,  // existing recipe
 * });
 * ```
 */
export function defineRule<
	TOptions extends Record<string, unknown> = Record<string, never>,
>(
	def: Omit<Rule<TOptions>, "run" | "with" | "as"> & {
		/** Optional override of the auto-generated run() bridge. */
		run?: Rule<TOptions>["run"];
	},
): Rule<TOptions> {
	if (!def.name?.trim()) throw new Error("defineRule: name is required");
	if (!def.displayName?.trim())
		throw new Error("defineRule: displayName is required");
	if (!def.description?.trim())
		throw new Error("defineRule: description is required");
	if (!def.severity) throw new Error("defineRule: severity is required");
	if (typeof def.lint !== "function")
		throw new Error("defineRule: lint must be a function");

	// Bridge: when used as a Recipe, run lint() and map diagnostics to report calls.
	// Errors become report.needsReview(), warnings become report.warn(),
	// info becomes report.change() with a note prefix.
	const run: Rule<TOptions>["run"] =
		def.run ??
		(async (ctx: RecipeContext<TOptions>) => {
			const diagnostics = await def.lint(ctx as LintContext<TOptions>);
			for (const d of diagnostics) {
				const sev = d.severity ?? def.severity;
				const msg = `[${def.name}] ${d.message}`;
				if (sev === "error") {
					ctx.report.needsReview(msg);
				} else {
					ctx.report.warn(msg);
				}
			}
			return undefined;
		});

	const rule: Rule<TOptions> = {
		...def,
		run,

		with(boundOptions) {
			return { recipe: rule, options: boundOptions };
		},

		as(severity: LintSeverity): Rule<TOptions> {
			return defineRule({ ...def, severity });
		},
	};

	return rule;
}
