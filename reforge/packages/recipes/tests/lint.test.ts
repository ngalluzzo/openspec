import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import type { NodeVisitor, ParserAdapter } from "@reforge/core";
import { parse } from "@reforge/core";
import { createQuery } from "@reforge/transform";
import { defineRecipe } from "../src/define.js";
import { defineRule } from "../src/defineRule.js";
import { runRules } from "../src/runRules.js";

// ─── Minimal fake adapter ─────────────────────────────────────────────────────

type FN = {
	type: string;
	value: string;
	start: number;
	end: number;
	children?: FN[];
};

const fakeAdapter: ParserAdapter<FN> = {
	language: "fake",
	parse(source): FN {
		// Simple line-by-line parser: each non-empty line is a Stmt
		const children: FN[] = [];
		let offset = 0;
		for (const line of source.split("\n")) {
			if (line.trim()) {
				children.push({
					type: "Stmt",
					value: line.trim(),
					start: offset,
					end: offset + line.length,
				});
			}
			offset += line.length + 1;
		}
		return {
			type: "Root",
			value: source,
			start: 0,
			end: source.length,
			children,
		};
	},
	parseSnippet(s): FN {
		return { type: "Stmt", value: s, start: 0, end: s.length };
	},
	walk(root, visitor: NodeVisitor<FN>) {
		function v(n: FN, p: FN | null) {
			visitor.enter?.(n, p, null);
			for (const c of n.children ?? []) v(c, n);
			visitor.leave?.(n, p, null);
		}
		v(root, null);
	},
	locate: (n) => ({
		start: { offset: n.start, line: 1, column: 0 },
		end: { offset: n.end, line: 1, column: 0 },
	}),
	typeOf: (n) => n.type,
	print: (n) => (n as FN).value,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(source: string) {
	const result = parse(source, { adapter: fakeAdapter });
	const query = createQuery(result);
	return {
		source,
		filePath: "test.fake",
		options: {},
		query,
		snippet: () => {
			throw new Error("no snippet in lint");
		},
		report: { change: () => {}, warn: () => {}, needsReview: () => {} },
		result,
	};
}

// ─── defineRule ───────────────────────────────────────────────────────────────

describe("defineRule", () => {
	it("creates a rule with required fields", () => {
		const r = defineRule({
			name: "test/rule",
			displayName: "Test rule",
			description: "A test rule",
			severity: "warning",
			lint: () => [],
		});
		expect(r.name).toBe("test/rule");
		expect(r.severity).toBe("warning");
		expect(typeof r.lint).toBe("function");
	});

	it("satisfies the Recipe interface (has run method)", () => {
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [],
		});
		expect(typeof r.run).toBe("function");
	});

	it("throws when severity is missing", () => {
		expect(() =>
			defineRule({
				name: "r",
				displayName: "r",
				description: "r",
				severity: undefined as any,
				lint: () => [],
			}),
		).toThrow(/severity/);
	});

	it("throws when lint is not a function", () => {
		expect(() =>
			defineRule({
				name: "r",
				displayName: "r",
				description: "r",
				severity: "warning",
				lint: "nope" as any,
			}),
		).toThrow(/lint/);
	});

	it("attaches .with() for composition", () => {
		const r = defineRule<{ max: number }>({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			options: { max: { type: "number", description: "max", required: true } },
			lint: () => [],
		});
		const bound = r.with({ max: 5 });
		expect(bound.recipe).toBe(r);
		expect(bound.options).toEqual({ max: 5 });
	});

	it(".as() creates a copy with different severity", () => {
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [],
		});
		const asError = r.as("error");
		expect(asError.severity).toBe("error");
		expect(asError.name).toBe("r"); // same name
		expect(asError).not.toBe(r); // different object
	});

	it("attaches optional fix recipe", () => {
		const fix = defineRecipe({
			name: "fix",
			displayName: "fix",
			description: "fix",
			run: () => {},
		});
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [{ message: "fixable", path: {} as any }],
			fix,
		});
		expect(r.fix).toBe(fix);
	});
});

// ─── Rule as a Recipe (bridge) ────────────────────────────────────────────────

describe("rule.run() — recipe bridge", () => {
	it("maps warning diagnostics to report.warn()", async () => {
		const warned: string[] = [];
		const r = defineRule({
			name: "test/warns",
			displayName: "Warns",
			description: "Warns",
			severity: "warning",
			lint: () => [{ message: "found a problem", path: {} as any }],
		});

		const ctx = makeCtx("some source");
		const report = {
			change: () => {},
			warn: (m: string) => warned.push(m),
			needsReview: () => {},
		};
		await r.run({ ...ctx, report });
		expect(warned).toHaveLength(1);
		expect(warned[0]).toContain("found a problem");
		expect(warned[0]).toContain("test/warns");
	});

	it("maps error diagnostics to report.needsReview()", async () => {
		const reviewed: string[] = [];
		const r = defineRule({
			name: "test/errors",
			displayName: "Errors",
			description: "Errors",
			severity: "error",
			lint: () => [{ message: "critical issue", path: {} as any }],
		});

		const ctx = makeCtx("some source");
		const report = {
			change: () => {},
			warn: () => {},
			needsReview: (m: string) => reviewed.push(m),
		};
		await r.run({ ...ctx, report });
		expect(reviewed).toHaveLength(1);
		expect(reviewed[0]).toContain("critical issue");
	});

	it("produces no report calls when lint finds nothing", async () => {
		const warned: string[] = [];
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [],
		});
		const ctx = makeCtx("clean source");
		await r.run({
			...ctx,
			report: {
				change: () => {},
				warn: (m) => warned.push(m),
				needsReview: () => {},
			},
		});
		expect(warned).toHaveLength(0);
	});
});

// ─── lint() function ─────────────────────────────────────────────────────────

describe("rule.lint()", () => {
	it("receives query and source in context", async () => {
		let capturedSource: string | undefined;
		let queryUsed = false;

		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "info",
			lint(ctx) {
				capturedSource = ctx.source;
				queryUsed = !!ctx.query;
				return [];
			},
		});

		const ctx = makeCtx("test source");
		await r.lint(ctx);
		expect(capturedSource).toBe("test source");
		expect(queryUsed).toBe(true);
	});

	it("can return diagnostics with path references", async () => {
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint({ query }) {
				return query.find("Stmt").map((p) => ({
					message: `Found statement: ${(p.node as FN).value}`,
					path: p,
				}));
			},
		});

		const ctx = makeCtx("hello\nworld");
		const diags = await r.lint(ctx);
		expect(diags).toHaveLength(2);
		expect(diags[0]?.message).toContain("hello");
		expect(diags[1]?.message).toContain("world");
	});

	it("can return async diagnostics", async () => {
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			async lint() {
				await Promise.resolve();
				return [{ message: "async diag", path: {} as any }];
			},
		});
		const diags = await r.lint(makeCtx("src"));
		expect(diags).toHaveLength(1);
		expect(diags[0]?.message).toBe("async diag");
	});

	it("supports per-diagnostic severity override", async () => {
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint() {
				return [
					{ message: "critical", path: {} as any, severity: "error" as const },
				];
			},
		});
		const diags = await r.lint(makeCtx("src"));
		expect(diags[0]?.severity).toBe("error");
	});

	it("supports per-diagnostic fixer", async () => {
		const fixFn = vi.fn();
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint() {
				return [{ message: "fixable", path: {} as any, fix: fixFn }];
			},
		});
		const diags = await r.lint(makeCtx("src"));
		expect(typeof diags[0]?.fix).toBe("function");
	});
});

// ─── runRules ─────────────────────────────────────────────────────────────────

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpDir: string;
beforeEach(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), "reforge-lint-"));
});
afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

async function setupFile(name: string, content: string) {
	const p = join(tmpDir, name);
	await writeFile(p, content);
	return p;
}

describe("runRules()", () => {
	it("returns empty diagnostics for clean files", async () => {
		const p = await setupFile("a.fake", "clean content");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.diagnostics).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
	});

	it("collects diagnostics with rule metadata", async () => {
		const p = await setupFile("b.fake", "line one\nline two");
		const r = defineRule({
			name: "test/always-warn",
			displayName: "Always warn",
			description: "Always warns",
			severity: "warning",
			lint({ query }) {
				return query
					.find("Stmt")
					.map((path) => ({ message: "found statement", path }));
			},
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics?.[0]?.ruleId).toBe("test/always-warn");
		expect(result.diagnostics?.[0]?.message).toBe("found statement");
		expect(result.diagnostics?.[0]?.filePath).toBe(p);
	});

	it("separates errors from warnings", async () => {
		const p = await setupFile("c.fake", "content");
		const errRule = defineRule({
			name: "err",
			displayName: "err",
			description: "err",
			severity: "error",
			lint: () => [{ message: "e", path: {} as any }],
		});
		const warnRule = defineRule({
			name: "warn",
			displayName: "warn",
			description: "warn",
			severity: "warning",
			lint: () => [{ message: "w", path: {} as any }],
		});
		const result = await runRules({
			rules: [errRule, warnRule],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.errors).toHaveLength(1);
		expect(result.warnings).toHaveLength(1);
	});

	it("marks fixable diagnostics when rule has a fix recipe", async () => {
		const p = await setupFile("d.fake", "content");
		const fix = defineRecipe({
			name: "fix",
			displayName: "fix",
			description: "fix",
			run: () => {},
		});
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [{ message: "fixable", path: {} as any }],
			fix,
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.diagnostics?.[0]?.fixable).toBe(true);
	});

	it("respects appliesTo filter", async () => {
		const p = await setupFile("e.fake", "skip me");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			appliesTo: () => false,
			lint: () => [{ message: "fixable", path: {} as any }],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.diagnostics).toHaveLength(0);
	});

	it("runs rules when appliesTo returns true", async () => {
		const p = await setupFile("e2.fake", "run me");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			appliesTo: () => true,
			lint: () => [{ message: "ran", path: {} as any }],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.diagnostics).toHaveLength(1);
		expect(result.diagnostics?.[0]?.message).toBe("ran");
	});

	it("summary counts are accurate", async () => {
		const p = await setupFile("f.fake", "a\nb\nc");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "error",
			lint({ query }) {
				return query.find("Stmt").map((path) => ({ message: "x", path }));
			},
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.summary.errorCount).toBe(result.errors.length);
		expect(result.summary.totalFiles).toBeGreaterThan(0);
	});
});

// ─── Output formatters ────────────────────────────────────────────────────────

describe("toSummary()", () => {
	it("returns clean message when no issues", async () => {
		const p = await setupFile("g.fake", "clean");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		const summary = result.toSummary();
		expect(summary).toContain("No issues");
	});

	it("lists violations with location and rule id", async () => {
		const p = await setupFile("h.fake", "bad content");
		const r = defineRule({
			name: "test/bad",
			displayName: "Bad",
			description: "Bad",
			severity: "error",
			lint: () => [{ message: "bad thing", path: {} as any }],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		const summary = result.toSummary();
		expect(summary).toContain("bad thing");
		expect(summary).toContain("test/bad");
	});

	it("shows fixable hint when fixable rules exist", async () => {
		const p = await setupFile("i.fake", "content");
		const fix = defineRecipe({
			name: "f",
			displayName: "f",
			description: "f",
			run: () => {},
		});
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "warning",
			lint: () => [{ message: "fixable", path: {} as any }],
			fix,
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		expect(result.toSummary()).toContain("--fix");
	});
});

describe("toEslintJson()", () => {
	it("produces valid ESLint-compatible JSON", async () => {
		const p = await setupFile("j.fake", "content");
		const r = defineRule({
			name: "r",
			displayName: "r",
			description: "r",
			severity: "error",
			lint: () => [{ message: "issue", path: {} as any }],
		});
		const result = await runRules({
			rules: [r],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		const json = result.toEslintJson();
		expect(() => JSON.parse(json)).not.toThrow();
		const parsed = JSON.parse(json);
		expect(Array.isArray(parsed)).toBe(true);
		// Each entry has filePath and messages
		expect(parsed[0]).toHaveProperty("filePath");
		expect(parsed[0]).toHaveProperty("messages");
		// Messages use ESLint severity numbers
		expect(parsed[0].messages[0].severity).toBe(2); // error = 2
	});

	it("severity numbers match ESLint convention", async () => {
		const p = await setupFile("k.fake", "content");
		const errRule = defineRule({
			name: "e",
			displayName: "e",
			description: "e",
			severity: "error",
			lint: () => [{ message: "e", path: {} as any }],
		});
		const warnRule = defineRule({
			name: "w",
			displayName: "w",
			description: "w",
			severity: "warning",
			lint: () => [{ message: "w", path: {} as any }],
		});
		const infoRule = defineRule({
			name: "i",
			displayName: "i",
			description: "i",
			severity: "info",
			lint: () => [{ message: "i", path: {} as any }],
		});
		const result = await runRules({
			rules: [errRule, warnRule, infoRule],
			include: [p],
			adapterFor: () => fakeAdapter,
		});
		const messages = JSON.parse(result.toEslintJson())[0].messages;
		expect(messages.find((m: any) => m.message === "e").severity).toBe(2);
		expect(messages.find((m: any) => m.message === "w").severity).toBe(1);
		expect(messages.find((m: any) => m.message === "i").severity).toBe(0);
	});
});
