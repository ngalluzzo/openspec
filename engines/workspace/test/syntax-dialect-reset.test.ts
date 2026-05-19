import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createActionExecutorAdapter } from "@openspec/action-executor";
import { createCompiler } from "@openspec/compiler";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commanderProgramRecipeAdapter } from "../../../dialects/commander/src/index.ts";
import { typescriptSyntaxRenderAdapter } from "../../../dialects/typescript/src/index.ts";
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

describe("syntax/dialect reset", () => {
	test("provider selections are graph-visible and diagnose missing or ambiguous offerings", async () => {
		const selected = await compileWorkspace([
			{
				id: "provider.selection.single",
				protocol: "openspec.provider.v1",
				document: {
					owner: "test:provider-selection",
					providers: [{ id: "alpha" }],
					offerings: [
						{
							id: "alpha.render",
							provider: "provider.provider:alpha",
							role: "test.render",
							dialect: "test",
							params: { mode: "strict" },
						},
					],
					selectionRequests: [
						{
							id: "render.alpha",
							target: "syntax.unit:test.alpha",
							role: "test.render",
							dialect: "test",
							params: { mode: "strict" },
						},
					],
				},
			},
		]);

		expect(selected.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		expect(selected.runtime.node("provider.selection:render.alpha.alpha.render")).toMatchObject({
			kind: "provider.selection",
			attributes: expect.objectContaining({
				request: "render.alpha",
				provider: "provider.provider:alpha",
				offering: "alpha.render",
			}),
		});

		const missing = await compileWorkspace([
			{
				id: "provider.selection.missing",
				protocol: "openspec.provider.v1",
				document: {
					owner: "test:provider-selection",
					selectionRequests: [
						{
							id: "render.missing",
							target: "syntax.unit:test.missing",
							role: "test.render",
							dialect: "missing",
						},
					],
				},
			},
		]);
		expect(missing.diagnostics.map((d) => d.code)).toContain("provider.selection.missing");

		const ambiguous = await compileWorkspace([
			{
				id: "provider.selection.ambiguous",
				protocol: "openspec.provider.v1",
				document: {
					owner: "test:provider-selection",
					providers: [{ id: "alpha" }, { id: "beta" }],
					offerings: [
						{
							id: "alpha.render",
							provider: "provider.provider:alpha",
							role: "test.render",
							dialect: "test",
						},
						{
							id: "beta.render",
							provider: "provider.provider:beta",
							role: "test.render",
							dialect: "test",
						},
					],
					selectionRequests: [
						{
							id: "render.ambiguous",
							target: "syntax.unit:test.ambiguous",
							role: "test.render",
							dialect: "test",
						},
					],
				},
			},
		]);
		expect(ambiguous.diagnostics.map((d) => d.code)).toContain("provider.selection.ambiguous");

		const pinned = await compileWorkspace([
			{
				id: "provider.selection.pinned",
				protocol: "openspec.provider.v1",
				document: {
					owner: "test:provider-selection",
					providers: [{ id: "alpha" }, { id: "beta" }],
					offerings: [
						{
							id: "alpha.render",
							provider: "provider.provider:alpha",
							role: "test.render",
							dialect: "test",
						},
						{
							id: "beta.render",
							provider: "provider.provider:beta",
							role: "test.render",
							dialect: "test",
						},
					],
					selectionRequests: [
						{
							id: "render.pinned",
							target: "syntax.unit:test.pinned",
							role: "test.render",
							dialect: "test",
							provider: "provider.provider:beta",
						},
					],
				},
			},
		]);
		expect(pinned.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		expect(pinned.runtime.node("provider.selection:render.pinned.beta.render")).toMatchObject({
			attributes: expect.objectContaining({
				provider: "provider.provider:beta",
				offering: "beta.render",
			}),
		});
	}, 30000);

	test("syntax protocol lowers structural units, references, and dependencies", async () => {
		const result = await compileWorkspace([
			{
				id: "syntax.reset.model",
				protocol: "openspec.model.v1",
				document: {
					owner: "domain:crm",
					declarations: [
						{
							kind: "object",
							name: "Account",
							fields: [{ name: "id", type: "string" }],
						},
					],
				},
			},
			{
				id: "syntax.reset.syntax",
				protocol: "openspec.syntax.v1",
				document: {
					owner: "domain:crm",
					namespace: "crm",
					units: [{ id: "schemas", kind: "model.type.surface", role: "model.type.surface" }],
					symbols: [
						{
							id: "AccountSchema",
							unit: "schemas",
							kind: "model.declaration",
							name: "AccountSchema",
							target: "model:domain:crm.Account",
						},
					],
					slots: [
						{
							id: "AccountSchema.value",
							unit: "schemas",
							kind: "type.declaration",
							symbol: "AccountSchema",
							target: "model:domain:crm.Account",
						},
					],
					references: [
						{
							id: "AccountSchema.model",
							unit: "schemas",
							kind: "model.reference",
							from: "syntax.symbol:crm.AccountSchema",
							to: "model:domain:crm.Account",
						},
					],
					dependencies: [
						{
							id: "AccountSchema.value",
							unit: "schemas",
							kind: "slot.dependency",
							from: "syntax.symbol:crm.AccountSchema",
							to: "syntax.slot:crm.AccountSchema.value",
						},
					],
				},
			},
		]);

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);

		const symbols = result.runtime.select("syntax.symbolsForUnit", {
			unit: "schemas",
		}) as Array<{ id: string; target: string }>;
		expect(symbols).toContainEqual(
			expect.objectContaining({ id: "AccountSchema", target: "model:domain:crm.Account" }),
		);

		const references = result.runtime.select("syntax.referencesForUnit", {
			unit: "syntax.unit:crm.schemas",
		}) as Array<{ id: string; to: string }>;
		expect(references).toContainEqual(
			expect.objectContaining({ id: "AccountSchema.model", to: "model:domain:crm.Account" }),
		);

		const dependencies = result.runtime.select("syntax.dependenciesForUnit", {
			unit: "schemas",
		}) as Array<{ id: string; from: string; to: string }>;
		expect(dependencies).toContainEqual(
			expect.objectContaining({
				id: "AccountSchema.value",
				from: "syntax.symbol:crm.AccountSchema",
				to: "syntax.slot:crm.AccountSchema.value",
			}),
		);
	}, 10000);

	test("typed dialect packages own TypeScript and Zod facet selectors", async () => {
		const result = await compileWorkspace([
			{
				id: "syntax.reset.facet.targets",
				protocol: "openspec.syntax.v1",
				document: {
					owner: "domain:crm",
					namespace: "crm",
					units: [{ id: "schemas", kind: "model.type.surface" }],
					slots: [
						{
							id: "AccountSchema.value",
							unit: "schemas",
							kind: "type.declaration",
							target: "model:domain:crm.Account",
						},
					],
				},
			},
			{
				id: "syntax.reset.facets",
				protocol: "openspec.facet.v1",
				document: {
					owner: "domain:crm",
					facets: [
						{
							id: "crm.schemas.zod.import",
							kind: "typescript.import",
							target: "syntax.unit:crm.schemas",
							value: {
								unit: "syntax.unit:crm.schemas",
								module: "zod",
								named: [{ imported: "z" }],
							},
						},
						{
							id: "crm.Account.zod.expression",
							kind: "typescript.expression",
							target: "syntax.slot:crm.AccountSchema.value",
							value: {
								provider: "zod",
								role: "value.expression",
								unit: "syntax.unit:crm.schemas",
								expression: {
									kind: "call",
									callee: {
										kind: "member",
										object: { kind: "identifier", name: "z" },
										property: "object",
									},
									arguments: [{ kind: "object", properties: [] }],
								},
							},
						},
					],
				},
			},
		]);

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);

		const imports = result.runtime.select("typescript.importsForUnit", {
			unit: "syntax.unit:crm.schemas",
		}) as Array<{ value: { module: string; named: Array<{ imported: string }> } }>;
		expect(imports).toContainEqual(
			expect.objectContaining({
				value: expect.objectContaining({ module: "zod", named: [{ imported: "z" }] }),
			}),
		);

		const zodExpressions = result.runtime.select(
			"zod.schemaExpressionsForTarget",
			{ target: "syntax.slot:crm.AccountSchema.value" },
		) as Array<{ value: { provider: string; role: string; expression: { kind: string } } }>;
		expect(zodExpressions).toEqual([
			expect.objectContaining({
				value: expect.objectContaining({
					provider: "zod",
					role: "value.expression",
					expression: expect.objectContaining({ kind: "call" }),
				}),
			}),
		]);
	}, 10000);

	test("typescript syntax render selector returns unit, asset, selected renderer, and typed facets", async () => {
		const result = await compileWorkspace([
			{
				id: "typescript.render.model",
				protocol: "openspec.model.v1",
				document: {
					owner: "domain:crm",
					declarations: [
						{
							kind: "object",
							name: "Account",
							fields: [{ name: "id", type: "string" }],
						},
					],
				},
			},
			{
				id: "typescript.render.syntax",
				protocol: "openspec.syntax.v1",
				document: {
					owner: "domain:crm",
					namespace: "crm",
					units: [{ id: "schemas", kind: "model.type.surface" }],
				},
			},
			{
				id: "typescript.render.asset",
				protocol: "openspec.asset.v1",
				document: {
					owner: "domain:crm",
					namespace: "crm.schemas.render",
					assets: [
						{
							id: "output",
							kind: "generated.artifact",
							locator: { kind: "file", path: "src/generated/crm.schemas.ts" },
							mediaType: "text/x.typescript",
						},
					],
				},
			},
			{
				id: "typescript.render.selection",
				protocol: "openspec.provider.v1",
				document: {
					owner: "domain:crm",
					selectionRequests: [
						{
							id: "crm.schemas.render.renderer",
							target: "syntax.unit:crm.schemas",
							role: "module.render",
							dialect: "typescript",
						},
					],
				},
			},
			{
				id: "typescript.render.facets",
				protocol: "openspec.facet.v1",
				document: {
					owner: "domain:crm",
					facets: [
						{
							id: "crm.schemas.import",
							kind: "typescript.import",
							target: "syntax.unit:crm.schemas",
							value: {
								unit: "syntax.unit:crm.schemas",
								module: "zod",
								named: [{ imported: "z" }],
							},
						},
						{
							id: "crm.Account.type",
							kind: "typescript.declaration",
							target: "model:domain:crm.Account",
							value: {
								unit: "syntax.unit:crm.schemas",
								kind: "typeAlias",
								name: "Account",
								exported: true,
								type: { kind: "raw", text: "{ id: string }" },
							},
						},
					],
				},
			},
		]);

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		const renderInput = result.runtime.select("typescript.syntaxRenderInput", {
			syntaxUnit: "syntax.unit:crm.schemas",
			asset: "asset.asset:crm.schemas.render.output",
		}) as {
			selections: Array<{ provider: string }>;
			imports: Array<{ value: { module: string } }>;
			declarations: Array<{ value: { name: string } }>;
		};
		expect(renderInput.selections).toContainEqual(
			expect.objectContaining({ provider: "provider.provider:typescript" }),
		);
		expect(renderInput.imports).toContainEqual(
			expect.objectContaining({ value: expect.objectContaining({ module: "zod" }) }),
		);
		expect(renderInput.declarations).toContainEqual(
			expect.objectContaining({ value: expect.objectContaining({ name: "Account" }) }),
		);
	}, 10000);

	test("model type output reaches TypeScript syntax render through composed facts", async () => {
		const result = await compileWorkspace([
			{
				id: "model.type.output.model",
				protocol: "openspec.model.v1",
				document: {
					owner: "domain:crm",
					declarations: [
						{
							kind: "object",
							name: "Account",
							fields: [
								{ name: "id", type: "string" },
								{ name: "score", type: "number", required: false },
							],
						},
					],
				},
			},
			{
				id: "model.type.output.application",
				protocol: "openspec.pattern.v1",
				document: {
					applications: [
						{
							id: "crm.types",
							pattern: "pattern.declaration:model.type-output",
							inputs: {
								owner: "domain:crm",
								id: "crm.types",
								namespace: "crm",
								declarations: [{ name: "Account" }],
								artifact: { path: "src/generated/crm.types.ts" },
							},
						},
					],
				},
			},
		]);

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		const actions = result.graph.nodes.filter((node) => node.kind === "planning.action");
		expect(actions.map((node) => node.attributes)).toContainEqual(
			expect.objectContaining({
				id: "crm.types",
				adapterId: "typescript.syntax.render",
				projectionKind: "projection.syntax.render",
			}),
		);

		const outputs = await createActionExecutorAdapter({
			adapters: [
				{
					id: "typescript.syntax.render",
					kind: "projection.syntax.render",
					capability: "capability.capability:artifact.render",
					adapter: typescriptSyntaxRenderAdapter,
				},
				{
					id: "commander.program.recipe",
					kind: "typescript.module.recipe",
					capability: "capability.capability:typescript.recipe.apply",
					adapter: commanderProgramRecipeAdapter,
				},
			],
		}).execute({ root: REPO_ROOT, graph: result.graph, runtime: result.runtime });

		expect(outputs).toContainEqual({
			location: "src/generated/crm.types.ts",
			content: "export type Account = { id: string; score?: number; };\n",
			disposition: "generated",
		});
	}, 10000);

	test("workspace Commander program is produced by syntax render without checked-in generated source", async () => {
		const result = await compileWorkspace();

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
		expect(
			result.graph.nodes
				.filter(
					(node) =>
						node.kind === "planning.action" &&
						node.attributes?.id === "workspace.cli.program",
				)
				.map((node) => node.attributes),
		).toEqual([
			expect.objectContaining({
				id: "workspace.cli.program",
				adapterId: "typescript.syntax.render",
				projectionKind: "projection.syntax.render",
				artifactPath: "engines/workspace/src/generated/workspace-cli-program.generated.ts",
			}),
		]);
		expect(
			result.runtime.node(
				"provider.selection:workspace.cli.program.cli.program.commander.cli.program.syntax",
			),
		).toMatchObject({
			attributes: expect.objectContaining({
				provider: "provider.provider:commander",
				role: "cli.program.syntax",
			}),
		});
		expect(
			result.graph.facets.filter(
				(facet) =>
					facet.kind === "commander.program.binding" &&
					facet.target === "syntax.unit:workspace.workspace.cli.program",
			),
		).toHaveLength(1);
		expect(
			result.graph.facets.filter(
				(facet) =>
					facet.kind === "typescript.recipe" &&
					facet.target === "syntax.unit:workspace.workspace.cli.program" &&
					facet.value?.providerSelectionRequest ===
						"workspace.cli.program.cli.program" &&
					facet.value?.adapter === "adapter.adapter:commander.program.recipe",
			),
		).toHaveLength(1);
		expect(
			result.graph.facets.filter(
				(facet) =>
					facet.kind === "typescript.declaration" &&
					facet.target === "syntax.unit:workspace.workspace.cli.program",
			),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					value: expect.objectContaining({ name: "WorkspaceCliHandlers" }),
				}),
				expect.objectContaining({
					value: expect.objectContaining({ name: "createWorkspaceCliProgram" }),
				}),
			]),
		);

		const outputs = await createActionExecutorAdapter({
			adapters: [
				{
					id: "typescript.syntax.render",
					kind: "projection.syntax.render",
					capability: "capability.capability:artifact.render",
					adapter: typescriptSyntaxRenderAdapter,
				},
				{
					id: "commander.program.recipe",
					kind: "typescript.module.recipe",
					capability: "capability.capability:typescript.recipe.apply",
					adapter: commanderProgramRecipeAdapter,
				},
			],
		}).execute({ root: REPO_ROOT, graph: result.graph, runtime: result.runtime });
		const program = outputs.find(
			(output) =>
				output.location ===
				"engines/workspace/src/generated/workspace-cli-program.generated.ts",
		);

		expect(program?.content).toContain('import { Command } from "commander";');
		expect(program?.content).toContain("export type WorkspaceBuildOptions");
		expect(program?.content).toContain("export type WorkspaceCliHandlers");
		expect(program?.content).toContain("export function createWorkspaceCliProgram");
		expect(program?.content).toContain('.name("openspec")');
		expect(program?.content).toContain('.command("build")');
		expect(program?.content).toContain(
			'policy?: "overwrite-generated" | "error-on-conflict"',
		);
		expect(program?.content).toContain('"workspace.build.default.run"');
		expect(program?.content).not.toContain("for (const entry of");
		expect(program?.content).not.toContain("export const WorkspaceCliCommands");
		expect(program?.content).not.toContain("[object Object]");
	}, 10000);

	test("syntax validation selectors expose missing unit links", async () => {
		const result = await compileWorkspace([
			{
				id: "syntax.reset.invalid",
				protocol: "openspec.syntax.v1",
				document: {
					owner: "domain:crm",
					namespace: "crm",
					symbols: [
						{
							id: "Missing",
							unit: "missing",
							kind: "model.declaration",
							name: "Missing",
						},
					],
				},
			},
		]);

		expect(result.diagnostics.map((d) => d.code)).toContain("graph.edge.missingFrom");

		const invalidLinks = result.runtime.select(
			"syntax.invalidSymbolUnitLinks",
			{},
		) as Array<{ nodeId: string; unitNodeId: string }>;
		expect(invalidLinks).toContainEqual(
			expect.objectContaining({
				nodeId: "syntax.symbol:crm.Missing",
				unitNodeId: "syntax.unit:crm.missing",
			}),
		);
	}, 10000);

	test("capability packages export generated SDK files from package-owned output specs", () => {
		const capabilitiesRoot = join(REPO_ROOT, "capabilities");
		const packageDirs = readdirSync(capabilitiesRoot)
			.map((entry) => join(capabilitiesRoot, entry))
			.filter((entry) => statSync(entry).isDirectory())
			.filter((entry) => existsSync(join(entry, "package.json")));

		expect(packageDirs.length).toBeGreaterThan(0);

		for (const dir of packageDirs) {
			const packageJson = JSON.parse(
				readFileSync(join(dir, "package.json"), "utf8"),
			) as {
				exports?: Record<string, unknown>;
				openspec?: { documents?: string[] };
			};
			const documents = packageJson.openspec?.documents ?? [];
			expect(documents.some((doc) => doc.endsWith(".output.openspec.yml"))).toBe(
				true,
			);

			for (const target of exportedSourceTargets(packageJson.exports)) {
				expect(existsSync(join(dir, target.slice("./".length)))).toBe(true);
			}

			const srcDir = join(dir, "src");
			if (!existsSync(srcDir)) continue;
			for (const file of collectFiles(srcDir)) {
				expect(file.includes(`${join("src", "sdk")}${"/"}`)).toBe(true);
				expect(file.endsWith(".generated.ts")).toBe(true);
			}
		}
	});
});

function exportedSourceTargets(exports: unknown): string[] {
	const result: string[] = [];
	const visit = (value: unknown) => {
		if (typeof value === "string" && value.startsWith("./src/")) {
			result.push(value);
			return;
		}
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			return;
		}
		for (const nested of Object.values(value)) visit(nested);
	};
	visit(exports);
	return result;
}

function collectFiles(dir: string): string[] {
	const result: string[] = [];
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			result.push(...collectFiles(path));
		} else {
			result.push(path);
		}
	}
	return result;
}
