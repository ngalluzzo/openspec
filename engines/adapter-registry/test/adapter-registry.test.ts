import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	discoverProjectionAdapterRegistry,
	discoverProjectionAdapters,
} from "../src/index.ts";

let root: string;

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "openspec-adapter-registry-test-"));
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

describe("discoverProjectionAdapterRegistry", () => {
	test("imports package-relative adapter modules", async () => {
		writeJson("node_modules/projection-pkg/package.json", {
			name: "projection-pkg",
			openspec: {
				version: 1,
				adapters: {
					implementations: [
						{
							kind: "projection.test",
							module: "./src/index.mjs",
							export: "projectionAdapter",
						},
					],
				},
				compatibility: { openspec: "^0.1.0" },
			},
		});
		writeText(
			"node_modules/projection-pkg/src/index.mjs",
			"export const projectionAdapter = { async project() { return { files: [], diagnostics: [] }; } };",
		);

		const registry = await discoverProjectionAdapterRegistry(root);

		expect(registry.diagnostics).toEqual([]);
		expect(registry.adapters).toHaveLength(1);
		expect(registry.adapters[0]?.kind).toBe("projection.test");
		await expect(
			registry.adapters[0]?.adapter.project({
				action: {
					id: "a",
					projectionKind: "projection.test",
					artifactPath: "a",
				},
				graph: {},
			}),
		).resolves.toEqual({ files: [], diagnostics: [] });
	});

	test("does not hardcode typed projection bridges in the registry", async () => {
		writeJson("node_modules/zod-like/package.json", {
			name: "zod-like",
			openspec: {
				version: 1,
				adapters: {
					implementations: [
						{
							id: "zod.model.schema.projection",
							kind: "projection.model.schema",
							capability: "capability.capability:model.schema.projection",
							module: "./src/index.mjs",
							export: "projectionAdapter",
						},
					],
				},
			},
		});
		writeText(
			"node_modules/zod-like/src/index.mjs",
			"export const projectionAdapter = { async project(input) { return { files: [{ path: input.action.artifactPath, mediaType: 'text/plain', text: JSON.stringify(input.action.projectionInputs) }], diagnostics: [] }; } };",
		);

		const registry = await discoverProjectionAdapterRegistry(root);
		const adapter = registry.adapters[0]?.adapter;

		await expect(
			adapter?.project({
				action: {
					id: "planning.action:zod",
					projectionKind: "projection.model.schema",
					artifactPath: "generated/schema.ts",
					projectionInputs: {
						facts: [{ schemaName: "AccountSchema" }],
					},
				},
				graph: {},
			}),
		).resolves.toEqual({
			files: [
				{
					path: "generated/schema.ts",
					mediaType: "text/plain",
					text: JSON.stringify({
						facts: [{ schemaName: "AccountSchema" }],
					}),
				},
			],
			diagnostics: [],
		});
	});

	test("convenience API rejects duplicate adapter ids", async () => {
		for (const name of ["a", "b"]) {
			writeJson(`node_modules/${name}/package.json`, {
				name,
				openspec: {
					adapters: {
						implementations: [
							{
								id: "duplicate.adapter",
								kind: "projection.duplicate",
								module: "./index.mjs",
								export: "x",
							},
						],
					},
				},
			});
			writeText(
				`node_modules/${name}/index.mjs`,
				"export const x = { async project() { return { files: [], diagnostics: [] }; } };",
			);
		}

		await expect(discoverProjectionAdapters(root)).rejects.toThrow(
			"openspec.adapter.id.duplicate",
		);
	});
});
