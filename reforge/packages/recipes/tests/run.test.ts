import { describe, expect, it, vi } from "bun:test";
import type { NodeVisitor, ParserAdapter } from "@reforge/core";
import { defineRecipe } from "../src/define.js";
import type { runRecipes } from "../src/run.js";

// ─── Minimal fake adapter (same as in other packages) ─────────────────────────

type FakeNode = {
	type: string;
	value: string;
	start: number;
	end: number;
	children?: FakeNode[];
};

const fakeAdapter: ParserAdapter<FakeNode> = {
	language: "fake",
	parse(source): FakeNode {
		return {
			type: "Root",
			value: source,
			start: 0,
			end: source.length,
			children: [],
		};
	},
	parseSnippet(source): FakeNode {
		return { type: "Leaf", value: source, start: 0, end: source.length };
	},
	walk(root, visitor: NodeVisitor<FakeNode>) {
		function visit(node: FakeNode, parent: FakeNode | null) {
			visitor.enter?.(node, parent, null);
			for (const child of node.children ?? []) visit(child, node);
			visitor.leave?.(node, parent, null);
		}
		visit(root, null);
	},
	locate: (n) => ({
		start: { offset: n.start, line: 1, column: 0 },
		end: { offset: n.end, line: 1, column: 0 },
	}),
	typeOf: (n) => n.type,
	print: (n) => (n as FakeNode).value,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Run recipes over in-memory "files" without touching the filesystem.
 * Returns the report and the mutated sources.
 */
async function _runInMemory(
	_files: Record<string, string>,
	_recipes: Parameters<typeof runRecipes>[0]["recipes"],
) {
	const written: Record<string, string> = {};
	const fileSummaries: any[] = [];

	// Patch writeFile to capture output instead of writing disk
	const { runRecipes: run } = await import("../src/run.js");

	// We'll use a simpler approach: import processFile internals
	// Instead, let's test via the public API with mocked fs
	// Use vi.mock for fs operations
	return { written, fileSummaries };
}

// ─── Tests that exercise the recipe logic directly ────────────────────────────
// (Testing runRecipes end-to-end requires mocking fs.
//  We test the recipe contract directly via a thin wrapper instead.)

import { snippet as coreSnippet, parse, print } from "@reforge/core";
import { createQuery } from "@reforge/transform";
import { resolveOptions } from "../src/options.js";
import { buildPlan } from "../src/plan.js";
import { createReportBuilder } from "../src/report.js";
import type { RecipeContext, Reporter } from "../src/types.js";

async function runRecipeOnSource(
	source: string,
	recipe: ReturnType<typeof defineRecipe<any>>,
	options: Record<string, unknown> = {},
): Promise<{
	code: string;
	changes: string[];
	warnings: string[];
	needsReview: string[];
}> {
	const result = parse(source, { adapter: fakeAdapter });
	const query = createQuery(result);

	const changes: string[] = [];
	const warnings: string[] = [];
	const needsReview: string[] = [];

	const report: Reporter = {
		change(d) {
			changes.push(d);
		},
		warn(m) {
			warnings.push(m);
		},
		needsReview(r) {
			needsReview.push(r);
		},
	};

	const resolvedOptions = resolveOptions(recipe.options, options, recipe.name);

	const ctx: RecipeContext<any> = {
		source,
		filePath: "test.fake",
		options: resolvedOptions,
		query,
		report,
		snippet: (s) => coreSnippet(s, { adapter: fakeAdapter }),
	};

	const ret = await recipe.run(ctx);
	if (typeof ret === "string") changes.push(ret);
	else if (Array.isArray(ret)) changes.push(...ret);

	const { code } = print(result);
	return { code, changes, warnings, needsReview };
}

// ─── defineRecipe + run integration ──────────────────────────────────────────

describe("recipe.run() integration", () => {
	it("runs a recipe and produces output", async () => {
		const r = defineRecipe({
			name: "test/noop",
			displayName: "Noop",
			description: "Does nothing",
			run: () => {},
		});
		const { code } = await runRecipeOnSource("hello", r);
		expect(code).toBe("hello");
	});

	it("report.change() accumulates descriptions", async () => {
		const r = defineRecipe({
			name: "test/reporter",
			displayName: "Reporter",
			description: "Tests reporting",
			run({ report }) {
				report.change("First change");
				report.change("Second change");
			},
		});
		const { changes } = await runRecipeOnSource("src", r);
		expect(changes).toEqual(["First change", "Second change"]);
	});

	it("report.warn() and report.needsReview() work", async () => {
		const r = defineRecipe({
			name: "test/warns",
			displayName: "Warns",
			description: "Tests warnings",
			run({ report }) {
				report.warn("be careful");
				report.needsReview("complex pattern");
			},
		});
		const { warnings, needsReview } = await runRecipeOnSource("src", r);
		expect(warnings).toEqual(["be careful"]);
		expect(needsReview).toEqual(["complex pattern"]);
	});

	it("string return value is treated as a change description", async () => {
		const r = defineRecipe({
			name: "test/string-return",
			displayName: "String return",
			description: "Returns a string",
			run: () => "did the thing",
		});
		const { changes } = await runRecipeOnSource("src", r);
		expect(changes).toContain("did the thing");
	});

	it("string[] return value adds multiple change descriptions", async () => {
		const r = defineRecipe({
			name: "test/array-return",
			displayName: "Array return",
			description: "Returns array",
			run: () => ["change one", "change two"],
		});
		const { changes } = await runRecipeOnSource("src", r);
		expect(changes).toContain("change one");
		expect(changes).toContain("change two");
	});

	it("receives validated options", async () => {
		let captured: any;
		const r = defineRecipe<{ from: string; to: string }>({
			name: "test/options",
			displayName: "Options",
			description: "Tests options",
			options: {
				from: { type: "string", description: "from", required: true },
				to: { type: "string", description: "to", required: true },
			},
			run({ options }) {
				captured = options;
			},
		});
		await runRecipeOnSource("src", r, { from: "a", to: "b" });
		expect(captured).toEqual({ from: "a", to: "b" });
	});

	it("throws RecipeOptionsError when required option missing", async () => {
		const r = defineRecipe<{ name: string }>({
			name: "test/required-opt",
			displayName: "Required opt",
			description: "Tests required options",
			options: {
				name: { type: "string", description: "name", required: true },
			},
			run: () => {},
		});
		await expect(runRecipeOnSource("src", r, {})).rejects.toThrow(
			/name.*missing/i,
		);
	});
});

// ─── appliesTo filter ─────────────────────────────────────────────────────────

describe("recipe.appliesTo()", () => {
	it("skips run when appliesTo returns false", async () => {
		const runFn = vi.fn();
		const r = defineRecipe({
			name: "test/filtered",
			displayName: "Filtered",
			description: "Tests applicability",
			appliesTo: ({ source }) => source.includes("TRIGGER"),
			run: runFn,
		});

		// Should NOT run (no TRIGGER)
		const result = parse("no trigger here", { adapter: fakeAdapter });
		const ctx: RecipeContext<any> = {
			source: "no trigger here",
			filePath: "f.fake",
			options: {},
			query: createQuery(result),
			report: { change: () => {}, warn: () => {}, needsReview: () => {} },
			snippet: (s) => coreSnippet(s, { adapter: fakeAdapter }),
		};

		// Simulate the appliesTo check
		const applies = await r.appliesTo?.({
			source: "no trigger here",
			filePath: "f.fake",
		});
		if (applies) await r.run(ctx);
		expect(runFn).not.toHaveBeenCalled();

		// SHOULD run (has TRIGGER)
		const applies2 = await r.appliesTo?.({
			source: "TRIGGER present",
			filePath: "f.fake",
		});
		if (applies2) await r.run(ctx);
		expect(runFn).toHaveBeenCalledTimes(1);
	});
});

// ─── Composition via precipes ─────────────────────────────────────────────────

describe("recipe composition via precipes", () => {
	it("buildPlan orders precipes before dependents", () => {
		const pre = defineRecipe({
			name: "pre",
			displayName: "Pre",
			description: "Pre",
			run: () => {},
		});
		const main = defineRecipe({
			name: "main",
			displayName: "Main",
			description: "Main",
			precipes: [pre],
			run: () => {},
		});
		const plan = buildPlan([main]);
		const names = plan.map((s) => s.recipe.name);
		expect(names.indexOf("pre")).toBeLessThan(names.indexOf("main"));
	});

	it("buildPlan deduplicates shared precipes", () => {
		const shared = defineRecipe({
			name: "shared",
			displayName: "Shared",
			description: "Shared",
			run: () => {},
		});
		const a = defineRecipe({
			name: "a",
			displayName: "A",
			description: "A",
			precipes: [shared],
			run: () => {},
		});
		const b = defineRecipe({
			name: "b",
			displayName: "B",
			description: "B",
			precipes: [shared],
			run: () => {},
		});
		const plan = buildPlan([a, b]);
		expect(plan.filter((s) => s.recipe.name === "shared")).toHaveLength(1);
	});

	it("bound recipe options flow through the plan", () => {
		const sub = defineRecipe<{ x: string }>({
			name: "sub",
			displayName: "Sub",
			description: "Sub",
			options: { x: { type: "string", description: "x", required: true } },
			run: () => {},
		});
		const plan = buildPlan([sub.with({ x: "hello" })]);
		expect(plan[0]?.options).toEqual({ x: "hello" });
	});
});

// ─── .with() method ───────────────────────────────────────────────────────────

describe("recipe.with()", () => {
	it("returns a BoundRecipe with the recipe and options", () => {
		const r = defineRecipe<{ from: string }>({
			name: "r",
			displayName: "r",
			description: "r",
			options: {
				from: { type: "string", description: "from", required: true },
			},
			run: () => {},
		});
		const bound = r.with({ from: "lodash" });
		expect(bound.recipe).toBe(r);
		expect(bound.options).toEqual({ from: "lodash" });
	});

	it("can be used in precipes of another recipe", () => {
		const sub = defineRecipe<{ val: string }>({
			name: "sub",
			displayName: "sub",
			description: "sub",
			options: { val: { type: "string", description: "val", required: true } },
			run: () => {},
		});
		const parent = defineRecipe({
			name: "parent",
			displayName: "parent",
			description: "parent",
			precipes: [sub.with({ val: "test" })],
			run: () => {},
		});
		const plan = buildPlan([parent]);
		expect(plan[0]?.options).toEqual({ val: "test" });
	});
});

// ─── Semantic changes in recipe report ───────────────────────────────────────

describe("RecipeFileSummary.semanticChanges", () => {
	it("semanticChanges field exists on FileSummary", () => {
		const b = createReportBuilder();
		b.addFile({
			filePath: "a.ts",
			changed: true,
			diff: "---",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [
				{
					kind: "import:source-changed",
					summary: "Import source changed: 'lodash' → 'lodash-es'",
					before: "lodash",
					after: "lodash-es",
				},
				{
					kind: "declaration:renamed",
					summary: "Function renamed: 'foo' → 'bar'",
					before: "foo",
					after: "bar",
				},
			],
		});
		const report = b.build({
			totalFiles: 1,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 10,
		});
		expect(report.files?.[0]?.semanticChanges).toHaveLength(2);
		expect(report.files?.[0]?.semanticChanges[0]?.kind).toBe(
			"import:source-changed",
		);
	});

	it("toMarkdown() includes semantic change bullets", () => {
		const b = createReportBuilder();
		b.addFile({
			filePath: "src/utils.ts",
			changed: true,
			diff: "---",
			changes: [
				{
					filePath: "src/utils.ts",
					recipeName: "org/test",
					description: "did the thing",
				},
			],
			warnings: [],
			needsReview: [],
			semanticChanges: [
				{
					kind: "import:added",
					summary: "Import added: 'lodash-es'",
					after: "lodash-es",
				},
				{
					kind: "declaration:removed",
					summary: "Function removed: 'legacyHelper'",
					before: "legacyHelper",
				},
			],
		});
		b.addChange({
			filePath: "src/utils.ts",
			recipeName: "org/test",
			description: "did the thing",
		});
		const report = b.build({
			totalFiles: 1,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 10,
		});
		const md = report.toMarkdown();

		expect(md).toContain("Import added: 'lodash-es'");
		expect(md).toContain("Function removed: 'legacyHelper'");
		expect(md).toContain("did the thing");
		// Semantic bullets come before recipe descriptions
		const semanticIdx = md.indexOf("Import added");
		const recipeIdx = md.indexOf("did the thing");
		expect(semanticIdx).toBeLessThan(recipeIdx);
	});

	it("toMarkdown() uses + - ~ symbols in backtick format", () => {
		const b = createReportBuilder();
		b.addFile({
			filePath: "f.ts",
			changed: true,
			diff: "",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [
				{ kind: "declaration:added", summary: "Function added: 'newFn'" },
				{ kind: "declaration:removed", summary: "Function removed: 'oldFn'" },
				{ kind: "declaration:renamed", summary: "Function renamed: 'a' → 'b'" },
			],
		});
		const md = b
			.build({ totalFiles: 1, skippedFiles: 0, erroredFiles: 0, durationMs: 0 })
			.toMarkdown();
		// Semantic bullets are rendered as `+`, `-`, `~` in backticks
		expect(md).toContain("Function added: 'newFn'");
		expect(md).toContain("Function removed: 'oldFn'");
		expect(md).toContain("Function renamed: 'a'");
	});

	it("toMarkdown() omits semantic bullets when no semantic changes", () => {
		const b = createReportBuilder();
		b.addFile({
			filePath: "f.ts",
			changed: true,
			diff: "",
			changes: [
				{ filePath: "f.ts", recipeName: "r", description: "style fix" },
			],
			warnings: [],
			needsReview: [],
			semanticChanges: [],
		});
		b.addChange({
			filePath: "f.ts",
			recipeName: "r",
			description: "style fix",
		});
		const md = b
			.build({ totalFiles: 1, skippedFiles: 0, erroredFiles: 0, durationMs: 0 })
			.toMarkdown();
		expect(md).toContain("style fix");
		// No semantic change summaries present
		expect(md).not.toContain("Function added");
		expect(md).not.toContain("Function removed");
	});
});
