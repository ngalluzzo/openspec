import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NodeVisitor, ParserAdapter } from "@reforge/core";
import { defineRecipe } from "../src/define.js";
import { runTemplates } from "../src/runTemplates.js";
import { defineTemplate } from "../src/template.js";

// ─── Fake adapter ─────────────────────────────────────────────────────────────

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
		return {
			type: "Root",
			value: source,
			start: 0,
			end: source.length,
			children: [],
		};
	},
	parseSnippet(s): FN {
		return { type: "Leaf", value: s, start: 0, end: s.length };
	},
	walk(root, visitor: NodeVisitor<FN>) {
		function v(node: FN, parent: FN | null) {
			visitor.enter?.(node, parent, null);
			for (const c of node.children ?? []) v(c, node);
			visitor.leave?.(node, parent, null);
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

// ─── Fixture helpers ──────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), "reforge-template-test-"));
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runTemplates", () => {
	it("generates files then runs wiring", async () => {
		const generatedPaths: string[] = [];

		const authTemplate = defineTemplate<{ authPath: string }>({
			name: "test/auth",
			displayName: "Auth",
			description: "Auth template",
			options: {
				authPath: { type: "string", description: "path", default: "auth" },
			},
			generate(vars) {
				return [
					{ path: `${vars.authPath}/index.ts`, content: `// auth index\n` },
					{ path: `${vars.authPath}/tokens.ts`, content: `// auth tokens\n` },
				];
			},
			run({ report }) {
				report.change("Wired auth into app");
			},
		});

		// Create a file to wire into
		await writeFile(join(tmpDir, "app.ts"), "// app\n");

		const result = await runTemplates({
			templates: [authTemplate],
			variables: { authPath: "src/auth" },
			projectRoot: tmpDir,
			include: [join(tmpDir, "app.ts")],
			adapterFor: () => fakeAdapter,
			mode: "apply",
			existingFilePolicy: "fail",
			onGenerate: (o) => {
				if (o.kind === "written") generatedPaths.push(o.path);
			},
		});

		// Generate phase
		expect(result.generate.plan.writeCount).toBe(2);
		expect(result.generate.apply?.writtenCount).toBe(2);
		expect(result.generate.apply?.skippedCount).toBe(0);
		expect(generatedPaths).toHaveLength(2);

		// Files were created
		const index = await readFile(join(tmpDir, "src/auth/index.ts"), "utf8");
		expect(index).toBe("// auth index\n");

		// Wire phase ran
		expect(result.wire.changes).toHaveLength(1);
		expect(result.wire.changes?.[0]?.description).toBe("Wired auth into app");
	});

	it("plan mode reports plan but writes nothing", async () => {
		const template = defineTemplate({
			name: "test/dry",
			displayName: "Dry",
			description: "Dry",
			generate: () => [{ path: "src/new.ts", content: "content" }],
			run: () => {},
		});

		const result = await runTemplates({
			templates: [template],
			projectRoot: tmpDir,
			include: [],
			adapterFor: () => fakeAdapter,
			mode: "plan",
			existingFilePolicy: "fail",
		});

		expect(result.generate.plan.writeCount).toBe(1);
		expect(result.generate.apply).toBeNull();

		// Nothing actually written
		await expect(
			readFile(join(tmpDir, "src/new.ts"), "utf8"),
		).rejects.toThrow();
	});

	it("skips existing files (idempotent re-runs)", async () => {
		await mkdir(join(tmpDir, "src"), { recursive: true });
		await writeFile(join(tmpDir, "src/auth.ts"), "existing content");

		const template = defineTemplate({
			name: "test/idem",
			displayName: "Idem",
			description: "Idem",
			generate: () => [{ path: "src/auth.ts", content: "new content" }],
			run: () => {},
		});

		const result = await runTemplates({
			templates: [template],
			projectRoot: tmpDir,
			include: [],
			adapterFor: () => fakeAdapter,
			mode: "apply",
			existingFilePolicy: "skip",
		});

		expect(result.generate.plan.skippedCount).toBe(1);
		expect(result.generate.apply?.skippedCount).toBe(1);
		// Original file preserved
		expect(await readFile(join(tmpDir, "src/auth.ts"), "utf8")).toBe(
			"existing content",
		);
	});

	it("plain recipes in templates array skip generate phase", async () => {
		const recipe = defineRecipe({
			name: "test/plain",
			displayName: "Plain",
			description: "Plain",
			run({ report }) {
				report.change("ran plain recipe");
			},
		});

		await writeFile(join(tmpDir, "app.ts"), "// app\n");

		const result = await runTemplates({
			templates: [recipe],
			projectRoot: tmpDir,
			include: [join(tmpDir, "app.ts")],
			adapterFor: () => fakeAdapter,
			mode: "apply",
			existingFilePolicy: "fail",
		});

		expect(result.generate.plan.writeCount).toBe(0);
		expect(result.wire.changes).toHaveLength(1);
		expect(result.wire.changes?.[0]?.description).toBe("ran plain recipe");
	});

	it("template variables are passed to generate and run", async () => {
		let capturedVars: any;
		let capturedOptions: any;

		const template = defineTemplate<{ name: string }>({
			name: "test/vars",
			displayName: "Vars",
			description: "Vars",
			options: {
				name: { type: "string", description: "name", required: true },
			},
			generate(vars) {
				capturedVars = vars;
				return [{ path: `${vars.name}.ts`, content: `// ${vars.name}` }];
			},
			run({ options }) {
				capturedOptions = options;
			},
		});

		await writeFile(join(tmpDir, "app.ts"), "// app\n");

		await runTemplates({
			templates: [template],
			variables: { name: "myservice" },
			projectRoot: tmpDir,
			include: [join(tmpDir, "app.ts")],
			adapterFor: () => fakeAdapter,
			mode: "apply",
			existingFilePolicy: "fail",
		});

		expect(capturedVars.name).toBe("myservice");
		expect(capturedOptions.name).toBe("myservice");

		const content = await readFile(join(tmpDir, "myservice.ts"), "utf8");
		expect(content).toBe("// myservice");
	});

	it("result.wire contains the full recipe report", async () => {
		const template = defineTemplate({
			name: "test/report",
			displayName: "Report",
			description: "Report",
			generate: () => [],
			run({ report }) {
				report.change("a change");
				report.warn("a warning");
			},
		});

		await writeFile(join(tmpDir, "app.ts"), "// app\n");

		const result = await runTemplates({
			templates: [template],
			projectRoot: tmpDir,
			include: [join(tmpDir, "app.ts")],
			adapterFor: () => fakeAdapter,
			mode: "apply",
			existingFilePolicy: "fail",
		});

		expect(result.wire.changes).toHaveLength(1);
		expect(result.wire.warnings).toHaveLength(1);
		expect(typeof result.wire.toMarkdown()).toBe("string");
		expect(typeof result.wire.toJson()).toBe("string");
	});
});
