import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverOpenSpecPackages } from "../src/index.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "openspec-discovery-test-"));
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

function writeJson(path: string, value: unknown) {
	const fullPath = join(root, path);
	mkdirSync(fullPath.replace(/\/[^/]+$/, ""), { recursive: true });
	writeFileSync(fullPath, JSON.stringify(value, null, 2));
}

function writeText(path: string, value: string) {
	const fullPath = join(root, path);
	mkdirSync(fullPath.replace(/\/[^/]+$/, ""), { recursive: true });
	writeFileSync(fullPath, value);
}

describe("discoverOpenSpecPackages", () => {
	test("normalizes canonical documents and package-relative adapter modules", () => {
		writeJson("node_modules/projection-pkg/package.json", {
			name: "projection-pkg",
			version: "1.2.3",
			openspec: {
				version: 1,
				documents: ["spec/package.openspec.yml"],
				adapters: {
					implementations: [
						{
							kind: "projection.test",
							capability: "capability.capability:model.schema.projection",
							module: "./src/index.js",
							export: "testProjectionAdapter",
						},
					],
				},
				compatibility: { openspec: "^0.1.0" },
			},
		});
		writeText("node_modules/projection-pkg/spec/package.openspec.yml", "");
		writeText("node_modules/projection-pkg/src/index.js", "export default {};");

		const index = discoverOpenSpecPackages({
			root,
			currentOpenSpecVersion: "0.1.0",
		});

		expect(index.packages).toHaveLength(1);
		expect(index.documents.map((document) => document.path)).toEqual([
			join(root, "node_modules/projection-pkg/spec/package.openspec.yml"),
		]);
		expect(index.adapterImplementations).toEqual([
			expect.objectContaining({
				kind: "projection.test",
				capability: "capability.capability:model.schema.projection",
				importPath: join(root, "node_modules/projection-pkg/src/index.js"),
				packageName: "projection-pkg",
			}),
		]);
		expect(index.diagnostics).toEqual([]);
	});

	test("supports legacy grouped document aliases", () => {
		writeJson("node_modules/@scope/patterns/package.json", {
			name: "@scope/patterns",
			openspec: {
				patterns: { documents: ["spec/pattern.openspec.yml"] },
				adapters: { documents: ["spec/adapter.openspec.yml"] },
			},
		});
		writeText("node_modules/@scope/patterns/spec/pattern.openspec.yml", "");
		writeText("node_modules/@scope/patterns/spec/adapter.openspec.yml", "");

		const index = discoverOpenSpecPackages({ root });

		expect(index.documents.map((document) => document.path).sort()).toEqual([
			join(root, "node_modules/@scope/patterns/spec/adapter.openspec.yml"),
			join(root, "node_modules/@scope/patterns/spec/pattern.openspec.yml"),
		]);
		expect(index.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
			"openspec.compatibility.missing",
		]);
	});

	test("finds nested dependency package manifests", () => {
		writeJson("node_modules/outer/package.json", { name: "outer" });
		writeJson("node_modules/outer/node_modules/inner/package.json", {
			name: "inner",
			openspec: {
				documents: ["spec/inner.openspec.yml"],
				compatibility: { openspec: "^0.1.0" },
			},
		});
		writeText(
			"node_modules/outer/node_modules/inner/spec/inner.openspec.yml",
			"",
		);

		const index = discoverOpenSpecPackages({
			root,
			currentOpenSpecVersion: "0.1.0",
		});

		expect(index.packages.map((pkg) => pkg.name)).toEqual(["inner"]);
	});

	test("dedupes symlinked package roots by realpath", () => {
		writeJson("packages/projection/package.json", {
			name: "projection",
			openspec: { documents: ["spec/package.openspec.yml"] },
		});
		writeText("packages/projection/spec/package.openspec.yml", "");
		mkdirSync(join(root, "node_modules"), { recursive: true });
		symlinkSync(
			"../packages/projection",
			join(root, "node_modules/projection"),
		);
		symlinkSync(
			"../packages/projection",
			join(root, "node_modules/projection-copy"),
		);

		const index = discoverOpenSpecPackages({ root });

		expect(index.packages).toHaveLength(1);
		expect(index.packages[0]?.realpath).toBe(
			realpathSync(join(root, "packages/projection")),
		);
	});

	test("reports invalid metadata without throwing", () => {
		writeJson("node_modules/bad/package.json", {
			name: "bad",
			openspec: {
				version: 2,
				documents: [42],
				adapters: {
					implementations: [{ kind: "projection.bad" }],
				},
			},
		});

		const index = discoverOpenSpecPackages({ root });

		expect(index.packages).toHaveLength(1);
		expect(index.packages[0]?.documentPaths).toEqual([]);
		expect(index.adapterImplementations).toEqual([]);
		expect(index.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			"openspec.manifest.version.unsupported",
		);
	});

	test("allows duplicate adapter kinds and reports duplicate adapter ids", () => {
		for (const name of ["a", "b"]) {
			writeJson(`node_modules/${name}/package.json`, {
				name,
				openspec: {
					adapters: {
						implementations: [
							{
								id: "adapter.duplicate",
								kind: "projection.duplicate",
								module: "./index.js",
								export: "x",
							},
						],
					},
				},
			});
			writeText(`node_modules/${name}/index.js`, "export const x = {};");
		}

		const index = discoverOpenSpecPackages({ root });

		expect(index.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
			"openspec.adapter.id.duplicate",
		);
	});
});
