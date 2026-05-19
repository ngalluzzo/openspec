import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createCompiler } from "@openspec/compiler";
import { fileURLToPath } from "node:url";
import { discoverWorkspaceDocuments } from "../src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

async function compileWorkspace(extraDocuments: unknown[] = []) {
	const { documents } = await discoverWorkspaceDocuments({
		root: REPO_ROOT,
	});
	return createCompiler({
		capabilities: {
			expressionEvaluator: createExpressoRuntime(),
		},
	}).compile({ documents: [...documents, ...extraDocuments] as never[] });
}

describe("entity-derived model records", () => {
	test("model identity is owner-qualified", async () => {
		const result = await compileWorkspace([
			{
				id: "owner.a.shared",
				protocol: "openspec.model.v1",
				document: {
					owner: "test.owner:a",
					declarations: [
						{ kind: "object", name: "Shared", fields: [{ name: "id", type: "string" }] },
					],
				},
			},
			{
				id: "owner.b.shared",
				protocol: "openspec.model.v1",
				document: {
					owner: "test.owner:b",
					declarations: [
						{ kind: "object", name: "Shared", fields: [{ name: "id", type: "string" }] },
					],
				},
			},
		]);

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		expect(result.runtime.node("model:test.owner:a.Shared")).toBeTruthy();
		expect(result.runtime.node("model:test.owner:b.Shared")).toBeTruthy();
	}, 10000);
});
