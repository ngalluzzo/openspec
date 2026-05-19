import type { Path, QueryBuilder } from "@reforge/transform";

// ─── Options schema ───────────────────────────────────────────────────────────

export type OptionType = "string" | "number" | "boolean" | "string[]" | "json";

export interface OptionDef {
	type: OptionType;
	description: string;
	required?: boolean;
	default?: unknown;
	/** Custom validator — throw with a message to reject the value */
	validate?: (value: unknown) => void;
}

export type OptionsSchema<TOptions extends Record<string, unknown>> = {
	[K in keyof TOptions]: OptionDef;
};

// ─── Reporter ─────────────────────────────────────────────────────────────────

export interface Reporter {
	/** Record a specific change with an explanation. */
	change(description: string): void;
	/** Non-fatal warning — shown in the report but doesn't fail. */
	warn(message: string): void;
	/** Flag this file for manual follow-up after the transform. */
	needsReview(reason: string): void;
}

// ─── Recipe context ───────────────────────────────────────────────────────────

export interface ApplicabilityContext {
	source: string;
	filePath: string;
}

export interface RecipeContext<TOptions extends Record<string, unknown>> {
	source: string;
	filePath: string;
	/** Resolved and validated options for this recipe run. */
	options: TOptions;
	/** Query builder — same API as the transform runner. */
	query: QueryBuilder<any>;
	/** Parse a snippet into a node for insertion. */
	snippet: (source: string) => any;
	/** Structured change reporting. */
	report: Reporter;
}

export type RecipeResult = undefined | string | string[];

// ─── Recipe ref — a recipe with optionally pre-bound options ──────────────────

export interface BoundRecipe<TOptions extends Record<string, unknown>> {
	recipe: Recipe<TOptions>;
	options: Partial<TOptions>;
}

export type RecipeRef = Recipe<any> | BoundRecipe<any>;

// ─── Recipe ───────────────────────────────────────────────────────────────────

export interface Recipe<
	TOptions extends Record<string, unknown> = Record<string, never>,
> {
	/**
	 * Namespaced identifier. Convention: "org.scope/recipe-name"
	 * Used for deduplication in composition graphs and as the registry key.
	 */
	name: string;
	displayName: string;
	description: string;
	tags?: string[];

	/** Typed options schema. Validated before run() is called. */
	options?: OptionsSchema<TOptions>;

	/**
	 * Recipes that must run before this one — per file, in order, deduplicated.
	 * Use recipe.with(options) to bind options to a sub-recipe.
	 */
	precipes?: RecipeRef[];

	/**
	 * Fast applicability filter. Called before parse() — return false to skip
	 * this file cheaply. A simple string search here can save enormous time
	 * on large codebases.
	 */
	appliesTo?: (ctx: ApplicabilityContext) => boolean | Promise<boolean>;

	/**
	 * The transform. Mutate via ctx.query — the same API as the transform runner.
	 * Return void, a change description string, or an array of descriptions.
	 */
	run: (ctx: RecipeContext<TOptions>) => RecipeResult | Promise<RecipeResult>;

	/**
	 * Return a bound copy of this recipe with options pre-filled.
	 * Used in precipes arrays for parameterised composition.
	 *
	 * @example
	 * precipes: [renameImport.with({ from: "old", to: "new" })]
	 */
	with(options: Partial<TOptions>): BoundRecipe<TOptions>;
}

// ─── Template types ───────────────────────────────────────────────────────────

/**
 * A file produced by a template's generate() phase.
 */
export interface GeneratedFile {
	/** Path relative to the project root. */
	path: string;
	/** Raw file content — any string, produced however you like. */
	content: string;
}

/**
 * A Template extends a Recipe with a generate() phase that creates new files.
 *
 * Execution order per project root:
 *   1. generate(vars)  — produce GeneratedFile[] descriptors
 *   2. plan/apply      — caller-owned policy decides whether files are written
 *   3. run(ctx)        — wire the generated files into existing code via the query API
 *
 * The generated files are available to run() via the normal file system —
 * runTemplates() processes them through the include/adapterFor pipeline after
 * the generate phase completes.
 */
export interface Template<
	TVars extends Record<string, unknown> = Record<string, never>,
> extends Recipe<TVars> {
	/**
	 * Produce the files this template creates.
	 * Called once per runTemplates() invocation (not per file).
	 */
	generate(vars: TVars): GeneratedFile[] | Promise<GeneratedFile[]>;
}

/**
 * Context passed to a Template's generate() phase.
 * Separate from RecipeContext — generate() runs before any files are parsed.
 */
export interface GenerateContext<TVars extends Record<string, unknown>> {
	vars: TVars;
	projectRoot: string;
	/** Convenience: resolve a path relative to projectRoot */
	resolve: (...parts: string[]) => string;
}

// ─── Lint rule types ──────────────────────────────────────────────────────────

export type LintSeverity = "error" | "warning" | "info";

/**
 * A single diagnostic produced by a rule's lint() function.
 *
 * Each diagnostic has a message, the path it applies to, and an
 * optional per-node fixer for IDE quickfix support.
 *
 * The rule-level fix recipe (rule.fix) handles bulk fixing of all
 * diagnostics in a file. Per-diagnostic fixers handle targeted
 * single-node fixes when called from an editor.
 */
export interface LintDiagnostic {
	/** Human-readable description of the violation. */
	message: string;
	/**
	 * The Path to the offending node.
	 * Used to extract source location for editor integration.
	 */
	path: Path<any>;
	/**
	 * Optional per-node fixer for IDE quickfix support.
	 * Mutates the parse result when called — use path methods directly.
	 * For bulk fixing, use the rule's fix recipe instead.
	 */
	fix?: (path: Path<any>) => void;
	/** Override the rule's default severity for this specific diagnostic. */
	severity?: LintSeverity;
}

/** Context passed to a rule's lint() function. Same as RecipeContext. */
export type LintContext<TOptions extends Record<string, unknown>> =
	RecipeContext<TOptions>;

/**
 * A Rule is a named, reusable lint check with an optional fix recipe.
 *
 * Rules satisfy the Recipe interface — they can be used anywhere
 * a Recipe is used. When used as a recipe, lint() diagnostics are
 * mapped to report.warn() calls with their messages.
 *
 * When used as a rule (in runRules()), diagnostics carry location
 * info and severity for structured reporting and editor integration.
 */
export interface Rule<
	TOptions extends Record<string, unknown> = Record<string, never>,
> extends Recipe<TOptions> {
	/** The rule's default severity. Overridable at the call site. */
	severity: LintSeverity;

	/**
	 * Produce diagnostics for this file.
	 * Should NOT mutate the AST — use path methods only for reading.
	 * Mutations belong in the fix recipe.
	 */
	lint(
		ctx: LintContext<TOptions>,
	): LintDiagnostic[] | Promise<LintDiagnostic[]>;

	/**
	 * Optional recipe that fixes all violations this rule finds.
	 * Separated from lint() so fixing is opt-in and auditable.
	 *
	 * Can be any existing Recipe — compose freely.
	 */
	fix?: Recipe<any>;

	/**
	 * Return a copy of this rule with a different severity.
	 * Useful when running shared rules with project-specific thresholds.
	 *
	 * @example
	 * runRules({ rules: [noLodash.as("error")] })
	 */
	as(severity: LintSeverity): Rule<TOptions>;
}

/**
 * A resolved diagnostic with location and rule metadata.
 * Emitted by runRules() — this is what editors and CI consume.
 */
export interface ResolvedDiagnostic {
	ruleId: string;
	ruleName: string;
	severity: LintSeverity;
	message: string;
	filePath: string;
	line: number;
	column: number;
	/** Whether this diagnostic has a fix available (fix recipe or per-node fixer). */
	fixable: boolean;
}
