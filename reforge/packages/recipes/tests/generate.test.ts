import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyGeneratePlan,
	createGeneratePlan,
	type ExistingFilePolicy,
} from "../src/generate.js";
import { defineTemplate } from "../src/template.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), "reforge-test-"));
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

function makeTemplate(files: Array<{ path: string; content: string }>) {
	return defineTemplate({
		name: "test/gen",
		displayName: "Gen",
		description: "Gen",
		generate: () => files,
		run: () => {},
	});
}

async function plan(
	files: Array<{ path: string; content: string }>,
	existingFilePolicy: ExistingFilePolicy = "fail",
) {
	return createGeneratePlan({
		templates: [makeTemplate(files)],
		variables: {},
		projectRoot: tmpDir,
		existingFilePolicy,
	});
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createGeneratePlan", () => {
	it("produces a deterministic valid plan without writing files", async () => {
		const result = await plan([
			{ path: "src/z.ts", content: "z" },
			{ path: "src/a.ts", content: "a" },
		]);

		expect(result.valid).toBe(true);
		expect(result.writeCount).toBe(2);
		expect(result.items.map((item) => item.path)).toEqual([
			"src/a.ts",
			"src/z.ts",
		]);
		expect(result.items.every((item) => item.action === "write")).toBe(true);

		await expect(readFile(join(tmpDir, "src/a.ts"), "utf8")).rejects.toThrow();
	});

	it("plans fail, skip, and replace policies for existing files", async () => {
		await mkdir(join(tmpDir, "src"), { recursive: true });
		await writeFile(join(tmpDir, "src/auth.ts"), "original");

		const failPlan = await plan(
			[{ path: "src/auth.ts", content: "new" }],
			"fail",
		);
		expect(failPlan.valid).toBe(false);
		expect(failPlan.errors[0]?.code).toBe("existing_file");

		const skipPlan = await plan(
			[{ path: "src/auth.ts", content: "new" }],
			"skip",
		);
		expect(skipPlan.valid).toBe(true);
		expect(skipPlan.items[0]?.action).toBe("skip");
		expect(skipPlan.skippedCount).toBe(1);

		const replacePlan = await plan(
			[{ path: "src/auth.ts", content: "new" }],
			"replace",
		);
		expect(replacePlan.valid).toBe(true);
		expect(replacePlan.items[0]?.action).toBe("replace");
		expect(replacePlan.replaceCount).toBe(1);
	});

	it("rejects invalid existing file policies at runtime", async () => {
		const result = await createGeneratePlan({
			templates: [makeTemplate([{ path: "src/auth.ts", content: "new" }])],
			variables: {},
			projectRoot: tmpDir,
			existingFilePolicy: "overwrite" as ExistingFilePolicy,
		});

		expect(result.valid).toBe(false);
		expect(result.errors[0]?.path).toBe("(existingFilePolicy)");
	});

	it("rejects unsafe generated paths", async () => {
		for (const unsafePath of [
			"",
			"/absolute.ts",
			"../escape.ts",
			"a/../escape.ts",
			"a//b.ts",
			"a/./b.ts",
			"a\\b.ts",
			"a/\0/b.ts",
			"C:/absolute.ts",
		]) {
			const result = await plan([{ path: unsafePath, content: "x" }]);
			expect(result.valid).toBe(false);
			expect(result.errors[0]?.code).toBe("unsafe_path");
		}
	});

	it("rejects duplicate target paths", async () => {
		const result = await plan([
			{ path: "src/a.ts", content: "a" },
			{ path: "src/a.ts", content: "b" },
		]);

		expect(result.valid).toBe(false);
		expect(result.errors[0]?.code).toBe("duplicate_path");
	});

	it("rejects directory and non-file target collisions", async () => {
		await mkdir(join(tmpDir, "src/auth.ts"), { recursive: true });
		const result = await plan([{ path: "src/auth.ts", content: "new" }]);

		expect(result.valid).toBe(false);
		expect(result.errors[0]?.code).toBe("target_not_file");
	});

	it("resolves template options before calling generate", async () => {
		let capturedVars: any;
		const t = defineTemplate<{ prefix: string }>({
			name: "test/vars",
			displayName: "Vars",
			description: "Vars",
			options: {
				prefix: { type: "string", description: "prefix", default: "my" },
			},
			generate(vars) {
				capturedVars = vars;
				return [{ path: `${vars.prefix}/auth.ts`, content: "x" }];
			},
			run: () => {},
		});

		const result = await createGeneratePlan({
			templates: [t],
			variables: { prefix: "custom" },
			projectRoot: tmpDir,
			existingFilePolicy: "fail",
		});

		expect(result.valid).toBe(true);
		expect(capturedVars.prefix).toBe("custom");
		expect(result.items[0]?.path).toBe("custom/auth.ts");
	});

	it("captures option validation and generate() errors as plan errors", async () => {
		const optionsTemplate = defineTemplate<{ name: string }>({
			name: "test/options",
			displayName: "Options",
			description: "Options",
			options: {
				name: { type: "string", description: "name", required: true },
			},
			generate: () => [],
			run: () => {},
		});
		const throwTemplate = defineTemplate({
			name: "test/throws",
			displayName: "Throws",
			description: "Throws",
			generate: () => {
				throw new Error("boom");
			},
			run: () => {},
		});

		const result = await createGeneratePlan({
			templates: [optionsTemplate, throwTemplate],
			variables: {},
			projectRoot: tmpDir,
			existingFilePolicy: "fail",
		});

		expect(result.valid).toBe(false);
		expect(result.errors.map((error) => error.code)).toEqual([
			"options",
			"generate",
		]);
	});
});

describe("applyGeneratePlan", () => {
	it("rejects invalid plans without writing", async () => {
		const invalidPlan = await plan([
			{ path: "src/a.ts", content: "a" },
			{ path: "src/a.ts", content: "b" },
		]);

		await expect(applyGeneratePlan(invalidPlan)).rejects.toThrow(
			"Cannot apply invalid generate plan.",
		);
		await expect(readFile(join(tmpDir, "src/a.ts"), "utf8")).rejects.toThrow();
	});

	it("writes valid plans in deterministic order and reports outcomes", async () => {
		const result = await plan([
			{ path: "src/z.ts", content: "z" },
			{ path: "src/a.ts", content: "a" },
		]);

		const applyResult = await applyGeneratePlan(result);

		expect(applyResult.writtenCount).toBe(2);
		expect(applyResult.errorCount).toBe(0);
		expect(applyResult.outcomes.map((outcome) => outcome.path)).toEqual([
			"src/a.ts",
			"src/z.ts",
		]);
		expect(await readFile(join(tmpDir, "src/a.ts"), "utf8")).toBe("a");
		expect(await readFile(join(tmpDir, "src/z.ts"), "utf8")).toBe("z");
	});

	it("skips and replaces according to the planned policy", async () => {
		await mkdir(join(tmpDir, "src"), { recursive: true });
		await writeFile(join(tmpDir, "src/skip.ts"), "original");
		await writeFile(join(tmpDir, "src/replace.ts"), "original");

		const skipPlan = await plan(
			[{ path: "src/skip.ts", content: "new" }],
			"skip",
		);
		const skipResult = await applyGeneratePlan(skipPlan);
		expect(skipResult.skippedCount).toBe(1);
		expect(await readFile(join(tmpDir, "src/skip.ts"), "utf8")).toBe(
			"original",
		);

		const replacePlan = await plan(
			[{ path: "src/replace.ts", content: "new" }],
			"replace",
		);
		const replaceResult = await applyGeneratePlan(replacePlan);
		expect(replaceResult.writtenCount).toBe(1);
		expect(replaceResult.outcomes[0]?.kind).toBe("written");
		expect(await readFile(join(tmpDir, "src/replace.ts"), "utf8")).toBe("new");
	});

	it("fails safely when filesystem state drifts between plan and apply", async () => {
		const result = await plan([
			{ path: "src/a.ts", content: "a" },
			{ path: "src/b.ts", content: "b" },
		]);

		await mkdir(join(tmpDir, "src"), { recursive: true });
		await writeFile(join(tmpDir, "src/b.ts"), "drift");

		const applyResult = await applyGeneratePlan(result);

		expect(applyResult.errorCount).toBe(1);
		expect(applyResult.writtenCount).toBe(0);
		await expect(readFile(join(tmpDir, "src/a.ts"), "utf8")).rejects.toThrow();
		expect(await readFile(join(tmpDir, "src/b.ts"), "utf8")).toBe("drift");
	});
});
