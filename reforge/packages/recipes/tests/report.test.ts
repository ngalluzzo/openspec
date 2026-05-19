import { describe, expect, it } from "bun:test";
import { createReportBuilder } from "../src/report.js";

function makeBuilder() {
	return createReportBuilder();
}

describe("createReportBuilder", () => {
	it("builds a report with zero activity", () => {
		const r = makeBuilder().build({
			totalFiles: 10,
			skippedFiles: 2,
			erroredFiles: 0,
			durationMs: 100,
		});
		expect(r.summary.totalFiles).toBe(10);
		expect(r.summary.changedFiles).toBe(0);
		expect(r.summary.skippedFiles).toBe(2);
		expect(r.changes).toHaveLength(0);
	});

	it("counts changed files from added files", () => {
		const b = makeBuilder();
		b.addFile({
			filePath: "a.ts",
			changed: true,
			diff: "---",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [],
		});
		b.addFile({
			filePath: "b.ts",
			changed: false,
			diff: "",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [],
		});
		const r = b.build({
			totalFiles: 2,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 50,
		});
		expect(r.summary.changedFiles).toBe(1);
	});

	it("counts changes per recipe", () => {
		const b = makeBuilder();
		b.addChange({
			filePath: "a.ts",
			recipeName: "org/r1",
			description: "did x",
		});
		b.addChange({
			filePath: "b.ts",
			recipeName: "org/r1",
			description: "did y",
		});
		b.addChange({
			filePath: "c.ts",
			recipeName: "org/r2",
			description: "did z",
		});
		const r = b.build({
			totalFiles: 3,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 0,
		});
		expect(r.summary.byRecipe["org/r1"]).toBe(2);
		expect(r.summary.byRecipe["org/r2"]).toBe(1);
	});

	it("accumulates warnings and needsReview", () => {
		const b = makeBuilder();
		b.addWarning({ filePath: "a.ts", recipeName: "r", message: "watch out" });
		b.addNeedsReview({
			filePath: "b.ts",
			recipeName: "r",
			reason: "complex case",
		});
		const r = b.build({
			totalFiles: 2,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 0,
		});
		expect(r.warnings).toHaveLength(1);
		expect(r.needsReview).toHaveLength(1);
	});
});

describe("RecipeReport.toMarkdown()", () => {
	it("produces a markdown string with summary table", () => {
		const b = makeBuilder();
		b.addFile({
			filePath: "a.ts",
			changed: true,
			diff: "diff",
			changes: [],
			warnings: [],
			needsReview: [],
			semanticChanges: [],
		});
		b.addChange({
			filePath: "a.ts",
			recipeName: "org/my-recipe",
			description: "Updated import",
		});
		const r = b.build({
			totalFiles: 5,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 1234,
		});
		const md = r.toMarkdown();
		expect(md).toContain("## Reforge migration report");
		expect(md).toContain("Files changed");
		expect(md).toContain("org/my-recipe");
		expect(md).toContain("Updated import");
	});

	it("includes needs-review section when present", () => {
		const b = makeBuilder();
		b.addNeedsReview({
			filePath: "tricky.ts",
			recipeName: "r",
			reason: "dynamic import",
		});
		const r = b.build({
			totalFiles: 1,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 0,
		});
		const md = r.toMarkdown();
		expect(md).toContain("manual review");
		expect(md).toContain("dynamic import");
	});

	it("includes warnings section when present", () => {
		const b = makeBuilder();
		b.addWarning({
			filePath: "warn.ts",
			recipeName: "r",
			message: "check this",
		});
		const r = b.build({
			totalFiles: 1,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 0,
		});
		expect(r.toMarkdown()).toContain("check this");
	});
});

describe("RecipeReport.toJson()", () => {
	it("produces valid JSON", () => {
		const r = makeBuilder().build({
			totalFiles: 3,
			skippedFiles: 0,
			erroredFiles: 0,
			durationMs: 50,
		});
		const json = r.toJson();
		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json);
		expect(parsed.summary.totalFiles).toBe(3);
	});

	it("includes changes and warnings in JSON", () => {
		const b = makeBuilder();
		b.addChange({ filePath: "f.ts", recipeName: "r", description: "x" });
		b.addWarning({ filePath: "f.ts", recipeName: "r", message: "y" });
		const parsed = JSON.parse(
			b
				.build({
					totalFiles: 1,
					skippedFiles: 0,
					erroredFiles: 0,
					durationMs: 0,
				})
				.toJson(),
		);
		expect(parsed.changes).toHaveLength(1);
		expect(parsed.warnings).toHaveLength(1);
	});
});
