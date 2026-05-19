import { describe, expect, test } from "bun:test";
import type { SemanticGraph } from "@openspec/compiler";
import { createActionExecutorAdapter } from "../src/index.ts";

function makeGraph(nodes: SemanticGraph["nodes"]): SemanticGraph {
	const edges: SemanticGraph["edges"] = [];
	const normalized = nodes.map((node) => {
		if (node.kind !== "projection.materializer") return node;
		const attrs = node.attributes as Record<string, unknown> | undefined;
		if (!attrs) return node;
		if (typeof attrs.adapter === "string") {
			edges.push({
				id: `${node.id}.adapter.${attrs.adapter}`,
				kind: "projection.materializer.adapter",
				from: node.id,
				to: attrs.adapter,
			} as SemanticGraph["edges"][number]);
		}
		if (typeof attrs.selector === "string") {
			edges.push({
				id: `${node.id}.selector.${attrs.selector}`,
				kind: "projection.materializer.selector",
				from: node.id,
				to: attrs.selector,
			} as SemanticGraph["edges"][number]);
		}
		const { adapter: _adapter, selector: _selector, ...rest } = attrs;
		return { ...node, attributes: rest };
	});
	return { nodes: normalized, edges, facets: [] };
}

describe("projection materializer execution", () => {
	test("passes selector facts to a materializer adapter and renders returned artifact recipes", async () => {
		let capturedInput: unknown;

		const executor = createActionExecutorAdapter({
			adapters: [
				{
					id: "zod.model.schema.projection",
					kind: "projection.model.schema",
					adapter: {
						async render(input: unknown) {
							capturedInput = input;
							return {
								kind: "text.file",
								text: "export const ok = true;",
								mediaType: "text/x.typescript",
							};
						},
					},
				},
			],
		});

		const outputs = await executor.execute({
			root: ".",
			graph: makeGraph([
				{
					id: "planning.action:zod.schema",
					kind: "planning.action",
					attributes: {
						id: "zod.schema",
						owner: "provider.provider:zod.model",
						projectionKind: "projection.model.schema",
						adapterId: "zod.model.schema.projection",
						artifactPath: "src/generated/zod-schema.ts",
						projectionInputs: {
							owner: "provider.provider:zod.model",
						},
					},
				},
				{
					id: "projection.materializer:zod.model.schema.projection",
					kind: "projection.materializer",
					attributes: {
						id: "zod.model.schema.projection",
						adapter: "adapter.adapter:zod.model.schema.projection",
						projectionKind: "projection.model.schema",
						selector: "selector.declaration:zod.schema.declarationsForOwner",
						paramsSource: "projectionInputs.paramsOrOwner",
						implementationMethod: "render",
					},
				},
				{
					id: "selector.declaration:zod.schema.declarationsForOwner",
					kind: "selector.declaration",
					attributes: {
						definition: {
							sources: {
								declaration: {
									kind: "nodes",
									filter: { kind: "zod.schema.declaration" },
								},
							},
							where: {
								$expr: {
									"===": [
										{ var: "row.declaration.attributes.owner" },
										{ var: "parameter.owner" },
									],
								},
							},
							result: {
								cardinality: "many",
								value: {
									$expr: { var: "row.declaration.attributes" },
								},
							},
						},
					},
				},
				{
					id: "zod.schema.declaration:Account",
					kind: "zod.schema.declaration",
					attributes: {
						owner: "provider.provider:zod.model",
						name: "Account",
						schemaName: "AccountSchema",
					},
				},
			]),
		});

		expect(capturedInput).toEqual([
			{
				owner: "provider.provider:zod.model",
				name: "Account",
				schemaName: "AccountSchema",
			},
		]);
		expect(outputs).toEqual([
			{
				location: "src/generated/zod-schema.ts",
				content: "export const ok = true;",
				disposition: "generated",
			},
		]);
	});

	test("can combine projection inputs with a projection-selected selector result", async () => {
		let capturedInput: unknown;

		const executor = createActionExecutorAdapter({
			adapters: [
				{
					id: "typescript.test.surface",
					kind: "projection.test.surface",
					adapter: {
						async render(input: unknown) {
							capturedInput = input;
							return {
								kind: "text.file",
								text: "// rendered sdk\n",
								mediaType: "text/x.typescript",
							};
						},
					},
				},
			],
		});

		const outputs = await executor.execute({
			root: ".",
			graph: makeGraph([
				{
					id: "planning.action:operation.sdk",
					kind: "planning.action",
					attributes: {
						id: "operation.sdk",
						projectionKind: "projection.test.surface",
						adapterId: "typescript.test.surface",
						artifactPath: "src/generated/sdk.ts",
						projectionInputs: {
							surfaceName: "OperationSurface",
							selector: "selector.declaration:test.sdkMethods",
							params: { owner: "test.owner" },
						},
					},
				},
				{
					id: "projection.materializer:typescript.test.surface",
					kind: "projection.materializer",
					attributes: {
						id: "typescript.test.surface",
						adapter: "adapter.adapter:typescript.test.surface",
						projectionKind: "projection.test.surface",
						selector: "projectionInputs.selector",
						paramsSource: "projectionInputs.params",
						inputMode: "projectionInputsWithSelectorResult",
						selectorResultField: "methods",
						implementationMethod: "render",
					},
				},
				{
					id: "selector.declaration:test.sdkMethods",
					kind: "selector.declaration",
					attributes: {
						definition: {
							sources: {
								method: {
									kind: "nodes",
									filter: { kind: "test.method" },
								},
							},
							where: {
								$expr: {
									"===": [
										{ var: "row.method.attributes.owner" },
										{ var: "parameter.owner" },
									],
								},
							},
							result: {
								cardinality: "many",
								value: { $expr: { var: "row.method.attributes" } },
							},
						},
					},
				},
				{
					id: "test.method:one",
					kind: "test.method",
					attributes: {
						owner: "test.owner",
						name: "run",
					},
				},
			]),
		});

		expect(capturedInput).toEqual({
			surfaceName: "OperationSurface",
			selector: "selector.declaration:test.sdkMethods",
			params: { owner: "test.owner" },
			methods: [{ owner: "test.owner", name: "run" }],
		});
		expect(outputs).toEqual([
			{
				location: "src/generated/sdk.ts",
				content: "// rendered sdk\n",
				disposition: "generated",
			},
		]);
	});

	test("provider selection drives the executed adapter for syntax render actions", async () => {
		let rendered = false;
		const executor = createActionExecutorAdapter({
			adapters: [
				{
					id: "typescript.syntax.render",
					kind: "projection.syntax.render",
					adapter: {
						async render() {
							rendered = true;
							return {
								kind: "text.file",
								text: "// selected renderer\n",
								mediaType: "text/x.typescript",
							};
						},
					},
				},
			],
		});

		const outputs = await executor.execute({
			root: ".",
			graph: makeGraph([
				{
					id: "planning.action:syntax.render",
					kind: "planning.action",
					attributes: {
						id: "syntax.render",
						projectionKind: "projection.syntax.render",
						artifactPath: "src/generated/surface.ts",
						projectionInputs: {
							providerSelectionRequest: "surface.renderer",
							syntaxUnit: "syntax.unit:surface.types",
							asset: "asset.asset:surface.output",
						},
					},
				},
				{
					id: "provider.selection:surface.renderer.typescript.syntax.render",
					kind: "provider.selection",
					attributes: {
						id: "surface.renderer.typescript.syntax.render",
						request: "surface.renderer",
						target: "syntax.unit:surface.types",
						role: "module.render",
						provider: "provider.provider:typescript",
						offering: "typescript.syntax.render",
						dialect: "typescript",
						adapter: "adapter.adapter:typescript.syntax.render",
						projectionKind: "projection.syntax.render",
					},
				},
				{
					id: "projection.materializer:typescript.syntax.render",
					kind: "projection.materializer",
					attributes: {
						id: "typescript.syntax.render",
						adapter: "adapter.adapter:typescript.syntax.render",
						projectionKind: "projection.syntax.render",
						selector: "selector.declaration:syntax.render.input",
						implementationMethod: "render",
					},
				},
				{
					id: "selector.declaration:syntax.render.input",
					kind: "selector.declaration",
					attributes: {
						definition: {
							result: {
								cardinality: "one",
								value: { $expr: { os_object: [] } },
							},
						},
					},
				},
			]),
		});

		expect(rendered).toBe(true);
		expect(outputs).toEqual([
			{
				location: "src/generated/surface.ts",
				content: "// selected renderer\n",
				disposition: "generated",
			},
		]);
	});
});
