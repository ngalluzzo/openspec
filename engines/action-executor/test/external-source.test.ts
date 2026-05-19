import { describe, expect, test } from "bun:test";
import type { SemanticGraph } from "@openspec/compiler";
import type { ExternalSourceAdapter } from "@openspec/external-source-capability";
import type { ProjectionExecuteAdapter } from "@openspec/projection-execute-capability";
import type { ProjectionAction } from "@openspec/projection-execute-capability/types";
import { createActionExecutorAdapter } from "../src/index.ts";

function makeGraph(nodes: SemanticGraph["nodes"]): SemanticGraph {
	return { nodes, edges: [], facets: [] };
}

function makePlanningAction(
	id: string,
	projectionKind: string,
	owner: string,
	artifactPath: string,
	extra: Record<string, unknown> = {},
): SemanticGraph["nodes"][number] {
	return {
		id: `planning.action:${id}` as ReturnType<typeof String>,
		kind: "planning.action",
		attributes: { id, owner, projectionKind, artifactPath, projectionInputs: null, ...extra },
	};
}

function capturingProjectionAdapter(capturedActions: ProjectionAction[]): ProjectionExecuteAdapter {
	return {
		async project({ action }) {
			capturedActions.push(action);
			return { diagnostics: [], files: [{ path: action.artifactPath, text: "// ok", mediaType: "text/typescript" }] };
		},
	};
}

function mockExternalSourceAdapter(state: unknown): ExternalSourceAdapter {
	return {
		async read() {
			return { state };
		},
	};
}

describe("externalSource adapter resolution", () => {
	test("sync adapter receives externalState from the registered external source adapter", async () => {
		const capturedActions: ProjectionAction[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "schema.projection", adapter: capturingProjectionAdapter(capturedActions) },
			],
			externalSourceAdapters: [
				{
					id: "adapter.adapter:db.schema.runtime",
					adapter: mockExternalSourceAdapter({ tables: ["users", "accounts"] }),
				},
			],
		});

		const graph = makeGraph([
			makePlanningAction("schema", "schema.projection", "provider.provider:p", "out/schema.ts", {
				externalSource: "adapter.adapter:db.schema.runtime",
			}),
		]);

		await adapter.execute({ root: ".", graph });

		expect(capturedActions).toHaveLength(1);
		expect(capturedActions[0]?.externalState).toEqual({ tables: ["users", "accounts"] });
	});

	test("adapter without externalSource field receives no externalState", async () => {
		const capturedActions: ProjectionAction[] = [];

		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "schema.projection", adapter: capturingProjectionAdapter(capturedActions) },
			],
			externalSourceAdapters: [
				{
					id: "adapter.adapter:db.schema.runtime",
					adapter: mockExternalSourceAdapter({ tables: ["users"] }),
				},
			],
		});

		const graph = makeGraph([
			// No externalSource on this action
			makePlanningAction("schema", "schema.projection", "provider.provider:p", "out/schema.ts"),
		]);

		await adapter.execute({ root: ".", graph });

		expect(capturedActions).toHaveLength(1);
		expect(capturedActions[0]).not.toHaveProperty("externalState");
	});

	test("missing externalSource adapter throws with planner.externalSource.unresolved", async () => {
		const adapter = createActionExecutorAdapter({
			adapters: [
				{ kind: "schema.projection", adapter: capturingProjectionAdapter([]) },
			],
			// no externalSourceAdapters registered
		});

		const graph = makeGraph([
			makePlanningAction("schema", "schema.projection", "provider.provider:p", "out/schema.ts", {
				externalSource: "adapter.adapter:nonexistent.runtime",
			}),
		]);

		await expect(adapter.execute({ root: ".", graph })).rejects.toThrow(
			"planner.externalSource.unresolved",
		);
	});
});
