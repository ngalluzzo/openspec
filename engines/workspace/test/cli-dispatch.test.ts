import { describe, expect, test } from "bun:test";
import { createExpressoRuntime } from "@gooi/expresso";
import { createCompiler } from "@openspec/compiler";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverWorkspaceDocuments } from "../src/index.ts";

const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

describe("@openspec/workspace CLI dispatch bridge", () => {
	test("joins CLI commands to host dispatch declarations", async () => {
		const { documents } = await discoverWorkspaceDocuments({
			root: REPO_ROOT,
		});
		const result = await createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
			},
		}).compile({ documents });
		const errors = result.diagnostics.filter((d) => d.severity === "error");
		expect(errors).toEqual([]);

		expect(result.runtime.hasSelector("entrypoint.surfaceDispatches")).toBe(true);
		const dispatches = result.runtime.select("entrypoint.surfaceDispatches", {
			surfaceKind: "cli.command",
			hostId: "workspace.cli",
		}) as Array<{
			id: string;
			adapter: string;
			dispatch: string;
			environment: string;
			method: string;
			operation: string;
			surface: { command: string };
			transport: string;
		}>;

		expect(dispatches).toContainEqual(
			expect.objectContaining({
				id: "workspace.build.cli",
				adapter: "adapter.adapter:workspace.build.default",
				dispatch: "workspace.build.default.run",
				environment: "workspace.cli",
				method: "capability.method:workspace.build.run",
				operation: "operation.operation:workspace.build",
				surface: expect.objectContaining({ command: "build" }),
				transport: "transport.transport:workspace.stdio",
			}),
		);

		expect(result.runtime.hasSelector("stdio.commandDispatches")).toBe(true);
		const commands = result.runtime.select("stdio.commandDispatches", {
			hostId: "workspace.cli",
		}) as Array<{ command: string; stdio: { output: string } }>;
		expect(commands).toContainEqual(
			expect.objectContaining({
				command: "build",
				stdio: expect.objectContaining({ output: "stdout" }),
			}),
		);

		expect(result.runtime.hasSelector("cli.invalidCommandSurfaces")).toBe(true);
		expect(result.runtime.select("cli.invalidCommandSurfaces", {})).toEqual([]);
	}, 15000);

	test("CLI dialect rejects malformed command surfaces", async () => {
		const { documents } = await discoverWorkspaceDocuments({
			root: REPO_ROOT,
		});
		const result = await createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
			},
		}).compile({
			documents: [
				...documents,
				{
					id: "bad.cli.surface",
					protocol: "openspec.facet.v1",
					document: {
						owner: "provider.provider:workspace",
						facets: [
							{
								id: "workspace.bad.cli",
								kind: "cli.command",
								target: "entrypoint.entrypoint:workspace.build.cli",
								value: {
									command: "Bad Command",
								},
							},
						],
					},
				},
			],
		});
		const errors = result.diagnostics.filter((d) => d.severity === "error");
		expect(errors).toContainEqual(
			expect.objectContaining({ code: "cli.command.invalid" }),
		);

		expect(result.runtime.hasSelector("cli.invalidCommandSurfaces")).toBe(true);
		expect(result.runtime.select("cli.invalidCommandSurfaces", {})).toContainEqual(
			expect.objectContaining({
				id: "cli.command:workspace.bad.cli",
				target: "entrypoint.entrypoint:workspace.build.cli",
			}),
		);
	}, 15000);

	test("transport dialects attach typed facets to generic transport and route facts", async () => {
		const { documents } = await discoverWorkspaceDocuments({
			root: REPO_ROOT,
		});
		const result = await createCompiler({
			capabilities: {
				expressionEvaluator: createExpressoRuntime(),
			},
		}).compile({
			documents: [
				...documents,
				{
					id: "test.provider",
					protocol: "openspec.provider.v1",
					document: {
						owner: "provider.provider:test",
						providers: [{ id: "test", name: "Test Provider" }],
					},
				},
				{
					id: "test.http.transport",
					protocol: "openspec.transport.v1",
					document: {
						owner: "provider.provider:test",
						transports: [{ id: "test.http", kind: "http" }],
					},
				},
				{
					id: "test.http.route",
					protocol: "openspec.route.v1",
					document: {
						owner: "provider.provider:test",
						routes: [
							{
								id: "test.accounts",
								kind: "path",
								pattern: { value: "/accounts" },
							},
						],
					},
				},
				{
					id: "test.http.facets",
					protocol: "openspec.facet.v1",
					document: {
						owner: "provider.provider:test",
						facets: [
							{
								id: "test.http.transport",
								kind: "http.transport",
								target: "transport.transport:test.http",
								value: { scheme: "https", host: "api.example.test" },
							},
							{
								id: "test.accounts.http",
								kind: "http.route",
								target: "route.route:test.accounts",
								value: { method: "GET", produces: ["application/json"] },
							},
						],
					},
				},
			],
		});

		expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);

		expect(result.runtime.hasSelector("stdio.transports")).toBe(true);
		expect(result.runtime.hasSelector("http.transports")).toBe(true);
		expect(result.runtime.hasSelector("http.routes")).toBe(true);

		expect(result.runtime.select("stdio.transports", {})).toContainEqual(
			expect.objectContaining({
				target: "transport.transport:workspace.stdio",
				value: expect.objectContaining({ output: "stdout" }),
			}),
		);
		expect(result.runtime.select("http.transports", {})).toContainEqual(
			expect.objectContaining({
				target: "transport.transport:test.http",
				value: expect.objectContaining({ scheme: "https" }),
			}),
		);
		expect(result.runtime.select("http.routes", {})).toContainEqual(
			expect.objectContaining({
				target: "route.route:test.accounts",
				value: expect.objectContaining({ method: "GET" }),
			}),
		);
	}, 15000);

	test("CLI authoring uses entrypoint transport surface facets", () => {
		const source = readFileSync(
			join(REPO_ROOT, "engines/workspace/spec/workspace.cli.openspec.yml"),
			"utf8",
		);
		expect(source).not.toContain("openspec.cli.v1");
		expect(source).toContain("pattern.declaration:cli.transport.command");
		expect(source).not.toContain("pattern.declaration:cli.stdio.command");
		expect(source).not.toContain("pattern.declaration:operation.entrypoint");
		expect(source).not.toContain("pattern.declaration:entrypoint.transport");
		expect(source).not.toContain("pattern.declaration:entrypoint.surface");
		expect(source).toContain("command: build");
	});

	test("CLI host does not hardcode capability method dispatch", () => {
		const source = readFileSync(
			join(REPO_ROOT, "engines/workspace/src/cli.ts"),
			"utf8",
		);
		expect(source).not.toContain("capability.method:");
		expect(source).not.toContain("dispatchers:");
	});
});
