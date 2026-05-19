import { describe, expect, test } from "bun:test";
import type { SemanticGraph } from "@openspec/compiler";
import type { ExternalSourceAdapter } from "@openspec/external-source-capability";
import type { PlatformApplyAdapter } from "@openspec/platform-apply-capability";
import type { PlatformSyncAdapter } from "@openspec/platform-sync-capability";
import type {
	PlatformMutation,
	SyncInput,
} from "@openspec/platform-sync-capability/types";
import { createActionExecutorAdapter } from "../src/index.ts";

function makeGraph(nodes: SemanticGraph["nodes"]): SemanticGraph {
	return { nodes, edges: [], facets: [] };
}

function makeSyncAction(
	attributes: Record<string, unknown>,
): SemanticGraph["nodes"][number] {
	return {
		id: `sync.action:${attributes.id}`,
		kind: "sync.action",
		attributes,
	};
}

function externalSource(capturedConfig: unknown[]): ExternalSourceAdapter {
	return {
		async read(input) {
			capturedConfig.push(input.config);
			return { state: { live: true } };
		},
	};
}

function platformSync(
	capturedInputs: SyncInput[],
	mutations: PlatformMutation[],
): PlatformSyncAdapter {
	return {
		async sync(input) {
			capturedInputs.push(input);
			return { diagnostics: [], mutations };
		},
	};
}

function platformApply(capturedMutations: unknown[]): PlatformApplyAdapter {
	return {
		async apply(input) {
			capturedMutations.push(input.mutations);
			return { applied: [], diagnostics: [] };
		},
	};
}

describe("sync executor", () => {
	test("resolves env config at execution time and passes it to sync adapters", async () => {
		process.env.OPENSPEC_TEST_TOKEN = "resolved-secret";
		const sourceConfigs: unknown[] = [];
		const syncInputs: SyncInput[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "airtable.crm.source",
					kind: "external.airtable.schema",
					capability: "capability.capability:external.source",
					adapter: externalSource(sourceConfigs),
				},
				{
					id: "airtable.schema.sync",
					kind: "sync.airtable.schema",
					capability: "capability.capability:platform.sync",
					adapter: platformSync(syncInputs, []),
				},
			],
		});

		await adapter.sync({
			root: ".",
			graph: makeGraph([
				makeSyncAction({
					id: "airtable.crm.sync",
					owner: "schema.workspace:crm",
					syncKind: "sync.airtable.schema",
					externalSource: "airtable.crm.source",
					syncAdapter: "airtable.schema.sync",
					config: { token: { env: "OPENSPEC_TEST_TOKEN" } },
				}),
			]),
			preview: true,
		});

		expect(sourceConfigs).toEqual([{ token: "resolved-secret" }]);
		expect(syncInputs[0]?.action.config).toEqual({ token: "resolved-secret" });
		expect(syncInputs[0]?.action.externalState).toEqual({ live: true });
	});

	test("missing env config fails before adapters are called", async () => {
		delete process.env.OPENSPEC_TEST_MISSING_TOKEN;
		const sourceConfigs: unknown[] = [];
		const syncInputs: SyncInput[] = [];
		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "airtable.crm.source",
					kind: "external.airtable.schema",
					capability: "capability.capability:external.source",
					adapter: externalSource(sourceConfigs),
				},
				{
					id: "airtable.schema.sync",
					kind: "sync.airtable.schema",
					capability: "capability.capability:platform.sync",
					adapter: platformSync(syncInputs, []),
				},
			],
		});

		await expect(
			adapter.sync({
				root: ".",
				graph: makeGraph([
					makeSyncAction({
						id: "airtable.crm.sync",
						owner: "schema.workspace:crm",
						syncKind: "sync.airtable.schema",
						externalSource: "airtable.crm.source",
						syncAdapter: "airtable.schema.sync",
						config: { token: { env: "OPENSPEC_TEST_MISSING_TOKEN" } },
					}),
				]),
				preview: true,
			}),
		).rejects.toThrow("sync.config.env.missing");

		expect(sourceConfigs).toEqual([]);
		expect(syncInputs).toEqual([]);
	});

	test("apply skips unsupported and breaking mutations unless forceBreaking is set", async () => {
		const applied: unknown[] = [];
		const mutations: PlatformMutation[] = [
			{
				operation: "create",
				kind: "field",
				id: "field.create",
				label: "Create field",
				breaking: false,
				supported: true,
				payload: {},
			},
			{
				operation: "delete",
				kind: "field",
				id: "field.delete",
				label: "Delete field",
				breaking: true,
				supported: true,
				payload: {},
			},
			{
				operation: "create",
				kind: "field",
				id: "field.unsupported",
				label: "Unsupported field",
				breaking: false,
				supported: false,
				payload: {},
			},
		];
		const adapter = createActionExecutorAdapter({
			adapters: [
				{
					id: "airtable.schema.sync",
					kind: "sync.airtable.schema",
					capability: "capability.capability:platform.sync",
					adapter: platformSync([], mutations),
				},
				{
					id: "airtable.schema.apply",
					kind: "sync.airtable.schema.apply",
					capability: "capability.capability:platform.apply",
					adapter: platformApply(applied),
				},
			],
		});

		const result = await adapter.sync({
			root: ".",
			graph: makeGraph([
				makeSyncAction({
					id: "airtable.crm.sync",
					owner: "schema.workspace:crm",
					syncKind: "sync.airtable.schema",
					syncAdapter: "airtable.schema.sync",
					platformTarget: "airtable.schema.apply",
				}),
			]),
		});

		expect(applied).toEqual([[mutations[0]]]);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "sync.mutation.breaking.skipped",
			}),
		);
		expect(result.diagnostics).toContainEqual(
			expect.objectContaining({
				code: "sync.mutation.unsupported.skipped",
			}),
		);

		applied.length = 0;
		await adapter.sync({
			root: ".",
			graph: makeGraph([
				makeSyncAction({
					id: "airtable.crm.sync",
					owner: "schema.workspace:crm",
					syncKind: "sync.airtable.schema",
					syncAdapter: "airtable.schema.sync",
					platformTarget: "airtable.schema.apply",
				}),
			]),
			forceBreaking: true,
		});

		expect(applied).toEqual([[mutations[0], mutations[1]]]);
	});
});
