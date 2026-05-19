import { resolve } from "node:path";
import type { ParserAdapter } from "@reforge/core";
import type {
	ExistingFilePolicy,
	GenerateApplyOutcome,
	GenerateApplyResult,
	GeneratePlan,
} from "./generate.js";
import {
	applyGeneratePlan,
	createGeneratePlan,
	formatGenerateApplyOutcome,
	formatGeneratePlanError,
} from "./generate.js";
import { buildPlan } from "./plan.js";
import type { RecipeFileSummary, RecipeReport } from "./report.js";
import { runRecipes } from "./run.js";
import { isTemplate } from "./template.js";
import type { Recipe, RecipeRef, Template } from "./types.js";

// ─── Options ──────────────────────────────────────────────────────────────────

export interface RunTemplatesOptions {
	/**
	 * Templates (and optionally plain recipes) to run.
	 * Templates have their generate() called first, then all run() methods
	 * execute as normal recipes during the wire phase.
	 */
	templates: (Template<any> | RecipeRef)[];

	/**
	 * Variables passed to every template's generate() and run() phases.
	 * Validated against each template's options schema.
	 */
	variables?: Record<string, unknown>;

	/**
	 * Absolute or relative path to the project root.
	 * Generated files are written relative to this directory.
	 * Default: process.cwd()
	 */
	projectRoot?: string;

	/**
	 * Glob patterns for existing files to wire into.
	 * Generated files are NOT automatically included here — add their
	 * paths explicitly if you want the wiring recipe to see them.
	 */
	include: string[];

	/** Glob patterns to exclude. node_modules is always excluded. */
	exclude?: string[];

	/** Resolve an adapter for a given file path. */
	adapterFor: (filePath: string) => ParserAdapter<any> | null;

	/** Whether to only preview generation or apply it before wiring. */
	mode: "plan" | "apply";

	/** Required policy for existing generated files. */
	existingFilePolicy: ExistingFilePolicy;

	/** Parallel workers for the wiring phase. Default: 8. */
	concurrency?: number;

	/** Called for each apply outcome in apply mode. */
	onGenerate?: (outcome: GenerateApplyOutcome) => void;

	/** Called after each file is processed during the wiring phase. */
	onFile?: (summary: RecipeFileSummary) => void;

	/** Called on errors during either phase. */
	onError?: (filePath: string, error: unknown) => void;
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface RunTemplatesResult {
	/** Results from the generate() phase. */
	generate: {
		plan: GeneratePlan;
		apply: GenerateApplyResult | null;
	};
	/** Results from the wiring (recipe run) phase. */
	wire: RecipeReport;
}

// ─── runTemplates ─────────────────────────────────────────────────────────────

/**
 * Run a set of templates against a project.
 *
 * Phase 1 — Generate:
 *   For each Template (in the order they appear in `templates`):
 *   - Resolve and validate variables against the template's options schema
 *   - Call template.generate(vars) to get GeneratedFile descriptors
 *   - Create a deterministic GeneratePlan using the required existing-file policy
 *   - In apply mode, apply the plan and call onGenerate() for each outcome
 *
 * Phase 2 — Wire:
 *   Run all templates and recipes through the standard runRecipes() pipeline,
 *   which handles file I/O, concurrency, format-preserving mutation, and reporting.
 *   Templates participate as normal recipes in this phase (their run() methods fire).
 *
 * @example
 * ```ts
 * const result = await runTemplates({
 *   templates: [jwtAuth],
 *   variables: { userModel: "User", authPath: "src/auth" },
 *   projectRoot: ".",
 *   include: ["src/app.ts"],
 *   adapterFor: () => tsAdapter,
 *   mode: "apply",
 *   existingFilePolicy: "fail",
 * });
 *
 * console.log(`Planned ${result.generate.plan.items.length} files`);
 * console.log(result.wire.toMarkdown());
 * ```
 */
export async function runTemplates(
	opts: RunTemplatesOptions,
): Promise<RunTemplatesResult> {
	const {
		templates,
		variables = {},
		projectRoot = process.cwd(),
		include,
		exclude,
		adapterFor,
		mode,
		existingFilePolicy,
		concurrency,
		onGenerate,
		onFile,
		onError,
	} = opts;

	const absRoot = resolve(projectRoot);

	// ── Phase 1: Generate ──────────────────────────────────────────────────────
	// Extract only Template instances (not plain recipes) for the generate phase.
	const templateInstances = extractTemplates(templates);

	const generatePlan = await createGeneratePlan({
		templates: templateInstances,
		variables,
		projectRoot: absRoot,
		existingFilePolicy,
	});

	for (const error of generatePlan.errors) {
		defaultOnPlanError(error);
	}

	let applyResult: GenerateApplyResult | null = null;
	if (mode === "apply") {
		applyResult = await applyGeneratePlan(generatePlan);
		for (const outcome of applyResult.outcomes) {
			(onGenerate ?? defaultOnGenerate)(outcome);
		}
	}

	// ── Phase 2: Wire ──────────────────────────────────────────────────────────
	// All templates and recipes participate as recipes in the wire phase.
	// The template's run() method handles wiring the generated files into
	// the existing codebase.
	// Bind variables to each template/recipe so they flow through as options.
	// If a ref is already a BoundRecipe, merge variables underneath (template-
	// level variables are lower priority than per-recipe bound options).
	const boundRefs = bindVariables(templates, variables ?? {});

	const wireReport = await runRecipes({
		recipes: boundRefs,
		include,
		exclude: exclude ?? [],
		adapterFor,
		dryRun: mode === "plan",
		concurrency: concurrency ?? 8,
		onFile: onFile ?? (() => {}),
		onError: onError ?? (() => {}),
	});

	return {
		generate: {
			plan: generatePlan,
			apply: applyResult,
		},
		wire: wireReport,
	};
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Bind top-level variables to each recipe/template as base options.
 * Per-recipe bound options (from .with()) take precedence over variables.
 */
function bindVariables(
	refs: (Template<any> | RecipeRef)[],
	variables: Record<string, unknown>,
): RecipeRef[] {
	return refs.map((ref) => {
		if (
			"recipe" in ref &&
			"options" in ref &&
			typeof (ref as { run?: unknown }).run !== "function"
		) {
			// Already a BoundRecipe — merge variables underneath existing options
			const bound = ref as { recipe: Recipe<any>; options: Partial<unknown> };
			return {
				recipe: bound.recipe,
				options: { ...variables, ...bound.options },
			};
		}
		// Plain Recipe or Template — wrap with variables as options
		return { recipe: ref as Recipe<any>, options: variables };
	});
}

/**
 * Extract Template instances from a mixed array of Templates and RecipeRefs.
 * Handles both direct Template objects and BoundRecipe wrappers.
 */
function extractTemplates(
	refs: (Template<any> | RecipeRef)[],
): Template<any>[] {
	const result: Template<any>[] = [];

	for (const ref of refs) {
		// Direct Template
		if (isTemplate(ref as Recipe<any>)) {
			result.push(ref as Template<any>);
			continue;
		}
		// BoundRecipe wrapping a Template
		if ("recipe" in ref) {
			const inner = (ref as { recipe: Recipe<any> }).recipe;
			if (isTemplate(inner)) {
				result.push(ref as unknown as Template<any>);
			}
		}
		// Plain Recipe — no generate phase, skip
	}

	// Also recurse into precipes to find nested templates
	// (A template's precipes might themselves be templates)
	const plan = buildPlan(refs as unknown as RecipeRef[]);
	for (const { recipe } of plan) {
		if (isTemplate(recipe) && !result.includes(recipe)) {
			result.push(recipe);
		}
	}

	// Deduplicate preserving first-seen order
	return [...new Map(result.map((t) => [t.name, t])).values()];
}

function defaultOnGenerate(outcome: GenerateApplyOutcome): void {
	const msg = formatGenerateApplyOutcome(outcome);
	if (outcome.kind === "error") {
		console.error(`[reforge/templates] ${msg}`);
	} else if (outcome.kind !== "skipped") {
		console.log(`[reforge/templates] ${msg}`);
	}
}

function defaultOnPlanError(error: GeneratePlan["errors"][number]): void {
	console.error(`[reforge/templates] ${formatGeneratePlanError(error)}`);
}
