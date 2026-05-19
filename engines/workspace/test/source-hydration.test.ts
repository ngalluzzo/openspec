import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverWorkspaceDocuments } from "../src/index.ts";

function fixtureRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "openspec-source-hydration-"));
	mkdirSync(join(root, "docs"), { recursive: true });
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: "hydration-fixture", private: true }),
	);
	return root;
}

async function withFixtureRoot<T>(run: (root: string) => Promise<T>): Promise<T> {
	const root = fixtureRoot();
	try {
		return await run(root);
	} finally {
		rmSync(root, { force: true, recursive: true });
	}
}

describe("workspace source hydration", () => {
	test("injects snapshot from document.source.path", async () => {
		await withFixtureRoot(async (root) => {
			writeFileSync(join(root, "snapshot.json"), JSON.stringify({ value: 42 }));
			writeFileSync(
				join(root, "docs", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: ../snapshot.json",
					"        mediaType: application/json",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
			expect(result.documents[0]?.document).toMatchObject({
				source: { path: "../snapshot.json", mediaType: "application/json" },
				snapshot: { value: 42 },
			});
		});
	});

	test("resolves source paths relative to the wrapper file", async () => {
		await withFixtureRoot(async (root) => {
			mkdirSync(join(root, "docs", "wrappers"), { recursive: true });
			writeFileSync(join(root, "docs", "snapshot.json"), JSON.stringify({ ok: true }));
			writeFileSync(
				join(root, "docs", "wrappers", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: ../snapshot.json",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
			expect(result.documents[0]?.document).toMatchObject({
				snapshot: { ok: true },
			});
		});
	});

	test("missing source file produces a discovery error", async () => {
		await withFixtureRoot(async (root) => {
			writeFileSync(
				join(root, "docs", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: missing.json",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						severity: "error",
						code: "openspec.document.source.missing",
					}),
				]),
			);
		});
	});

	test("invalid JSON source produces a discovery error", async () => {
		await withFixtureRoot(async (root) => {
			writeFileSync(join(root, "snapshot.json"), "{");
			writeFileSync(
				join(root, "docs", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: ../snapshot.json",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						severity: "error",
						code: "openspec.document.source.parse.failed",
					}),
				]),
			);
		});
	});

	test("source paths cannot resolve outside the workspace", async () => {
		await withFixtureRoot(async (root) => {
			writeFileSync(
				join(root, "docs", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: ../../outside.json",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						severity: "error",
						code: "openspec.document.source.outsideWorkspace",
					}),
				]),
			);
		});
	});

	test("existing inline snapshot is not overwritten", async () => {
		await withFixtureRoot(async (root) => {
			writeFileSync(join(root, "snapshot.json"), JSON.stringify({ value: "external" }));
			writeFileSync(
				join(root, "docs", "source.openspec.yml"),
				[
					'openspec: "1.0"',
					"documents:",
					"  - id: source.test",
					"    protocol: test.source.v1",
					"    document:",
					"      owner: origin.origin:test",
					"      source:",
					"        path: ../snapshot.json",
					"      snapshot:",
					"        value: inline",
				].join("\n"),
			);

			const result = await discoverWorkspaceDocuments({ root });
			expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
			expect(result.documents[0]?.document).toMatchObject({
				snapshot: { value: "inline" },
			});
		});
	});
});
