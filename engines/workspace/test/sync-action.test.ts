import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
import { discoverWorkspaceDocuments } from "../src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

describe("sync action protocol", () => {
	test("openspec.sync.action.v1 lowers config references into sync.action nodes", async () => {
		const { documents } = await discoverWorkspaceDocuments({ root: REPO_ROOT });
		const result = await createCompiler({
			capabilities: { expressionEvaluator: createExpressoRuntime() },
		}).compile({
			documents: [
				...documents,
				{
					id: "airtable.crm.sync",
					protocol: "openspec.sync.action.v1",
					document: {
						id: "airtable.crm.sync",
						owner: "schema.workspace:crm",
						syncKind: "sync.airtable.schema",
						externalSource: "airtable.crm.source",
						syncAdapter: "airtable.schema.sync",
						platformTarget: "airtable.schema.apply",
						config: {
							baseId: { env: "AIRTABLE_BASE_ID" },
							token: { env: "AIRTABLE_PAT" },
						},
					},
				},
			],
		});

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		const actions = result.graph.nodes
			.filter((node) => node.kind === "sync.action")
			.map((node) => node.attributes as Record<string, unknown>);

		expect(actions).toContainEqual(
			expect.objectContaining({
				id: "airtable.crm.sync",
				owner: "schema.workspace:crm",
				syncKind: "sync.airtable.schema",
				externalSource: "airtable.crm.source",
				syncAdapter: "airtable.schema.sync",
				platformTarget: "airtable.schema.apply",
				config: {
					baseId: { env: "AIRTABLE_BASE_ID" },
					token: { env: "AIRTABLE_PAT" },
				},
			}),
		);
	}, 15000);

	test("sync action validation rejects missing required adapter fields", async () => {
		const { documents } = await discoverWorkspaceDocuments({ root: REPO_ROOT });
		const result = await createCompiler({
			capabilities: { expressionEvaluator: createExpressoRuntime() },
		}).compile({
			documents: [
				...documents,
				{
					id: "bad.sync",
					protocol: "openspec.sync.action.v1",
					document: {
						id: "bad.sync",
						owner: "schema.workspace:crm",
						syncKind: "sync.airtable.schema",
						externalSource: "airtable.crm.source",
					},
				},
			],
		});

		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				severity: "error",
				code: "sync.action.requiredField.missing",
			}),
		);
	}, 15000);
});
