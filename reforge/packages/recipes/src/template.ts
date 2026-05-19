import type { Recipe, Template } from "./types.js";

/**
 * Define a template — a recipe that also generates new files.
 *
 * The generate() phase runs once per runTemplates() call to produce file
 * descriptors. runTemplates() plans those files first, optionally applies the
 * plan, and then run() wires files into the existing codebase using the normal
 * query API.
 *
 * @example
 * ```ts
 * export const jwtAuth = defineTemplate<{
 *   authPath: string;
 *   userModel: string;
 * }>({
 *   name: "org.myco/jwt-auth",
 *   displayName: "JWT auth system",
 *   description: "Installs a complete JWT auth flow",
 *
 *   options: {
 *     authPath:  { type: "string", description: "Auth directory", default: "src/auth" },
 *     userModel: { type: "string", description: "User model name", required: true },
 *   },
 *
 *   generate(vars) {
 *     return [
 *       { path: `${vars.authPath}/index.ts`,     content: renderIndex(vars) },
 *       { path: `${vars.authPath}/middleware.ts`, content: renderMiddleware(vars) },
 *     ];
 *   },
 *
 *   run({ query, options, snippet, report }) {
 *     // Wire the generated files into app.ts
 *     query.find("ImportDeclaration").last()
 *          ?.insertAfter(snippet(`import { authMiddleware } from "${options.authPath}";`));
 *     report.change("Registered auth middleware");
 *   },
 * });
 * ```
 */
export function defineTemplate<
	TVars extends Record<string, unknown> = Record<string, never>,
>(def: Omit<Template<TVars>, "with">): Template<TVars> {
	if (!def.name?.trim()) throw new Error("defineTemplate: name is required");
	if (!def.displayName?.trim())
		throw new Error("defineTemplate: displayName is required");
	if (!def.description?.trim())
		throw new Error("defineTemplate: description is required");
	if (typeof def.generate !== "function")
		throw new Error("defineTemplate: generate must be a function");
	if (typeof def.run !== "function")
		throw new Error("defineTemplate: run must be a function");

	const template: Template<TVars> = {
		...def,
		with(boundOptions) {
			return { recipe: template, options: boundOptions };
		},
	};

	return template;
}

/**
 * Type guard — returns true if a Recipe is also a Template
 * (i.e. has a generate() function).
 */
export function isTemplate(
	recipe: Recipe<Record<string, unknown>>,
): recipe is Template<Record<string, unknown>> {
	return typeof (recipe as { generate?: unknown }).generate === "function";
}
