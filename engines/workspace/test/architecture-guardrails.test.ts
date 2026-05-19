import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const forbiddenArchitectureTerms = [
	["openspec", ".schema", ".projection", ".v1"],
	["openspec", ".schema", ".mapping", ".v1"],
	["@openspec/", "schema"],
	["projections/", "prisma"],
	["projection-", "schema-drift"],
	["schema", ".drift", ".projection"],
];

const ignoredDirectories = new Set([
	".git",
	"node_modules",
	"dist",
	".turbo",
]);

describe("architecture guardrails", () => {
	test("retired schema projection/runtime names do not return", async () => {
		const files = await trackedTextFiles(REPO_ROOT);
		const failures: Array<{ file: string; term: string }> = [];

		for (const file of files) {
			const text = await readFile(file, "utf8");
			for (const parts of forbiddenArchitectureTerms) {
				const term = parts.join("");
				if (text.includes(term)) {
					failures.push({ file: relative(REPO_ROOT, file), term });
				}
			}
		}

		expect(failures).toEqual([]);
	});

	test("storage dialect renderers stay behind the syntax boundary", async () => {
		const rendererFiles = [
			join(REPO_ROOT, "dialects/prisma/src/index.ts"),
			join(REPO_ROOT, "dialects/drizzle/src/index.ts"),
		];

		for (const file of rendererFiles) {
			const text = await readFile(file, "utf8");
			const imports = text
				.split("\n")
				.filter((line) => line.trim().startsWith("import "));
			expect(imports).not.toContainEqual(expect.stringContaining(["@openspec/", "schema"].join("")));
			expect(imports).not.toContainEqual(expect.stringContaining(["@openspec/", "source"].join("")));
			expect(imports).not.toContainEqual(expect.stringContaining("/sources/"));
			expect(text).not.toContain("entity.declaration");
			expect(text).not.toContain("relation.declaration");
			expect(text).not.toContain("storage.schema-output");
		}
	});
});

async function trackedTextFiles(root: string): Promise<string[]> {
	const result: string[] = [];
	await walk(root, result);
	return result.filter((file) => {
		if (file.endsWith(".tsbuildinfo")) return false;
		if (file.endsWith(".png") || file.endsWith(".jpg") || file.endsWith(".jpeg")) return false;
		if (file.endsWith(".gif") || file.endsWith(".pdf") || file.endsWith(".zip")) return false;
		return true;
	});
}

async function walk(directory: string, result: string[]): Promise<void> {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (ignoredDirectories.has(entry.name)) continue;
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await walk(path, result);
			continue;
		}
		if (entry.isFile()) result.push(path);
	}
}
