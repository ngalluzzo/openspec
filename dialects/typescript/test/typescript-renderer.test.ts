import { describe, expect, test } from "bun:test";
import { typescriptSyntaxRenderAdapter } from "../src/index.ts";

describe("typescript syntax renderer", () => {
	test("renders selected TypeScript facets into a text file recipe", async () => {
		const recipe = await typescriptSyntaxRenderAdapter.render({
			unit: { nodeId: "syntax.unit:crm.schemas" },
			asset: {
				locator: { path: "src/generated/crm.schemas.ts" },
				mediaType: "text/x.typescript",
				disposition: "generated",
			},
			selections: [
				{
					provider: "provider.provider:typescript",
					dialect: "typescript",
					role: "module.render",
				},
			],
			imports: [
				{
					id: "crm.schemas.import",
					value: {
						module: "zod",
						named: [{ imported: "z" }],
					},
				},
			],
			declarations: [
				{
					id: "crm.Account.schema",
					value: {
						kind: "const",
						name: "AccountSchema",
						exported: true,
						value: {
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
				{
					id: "crm.Account.type",
					value: {
						kind: "typeAlias",
						name: "Account",
						exported: true,
						type: {
							kind: "typeQuery",
							expression: { kind: "identifier", name: "AccountSchema" },
						},
					},
				},
			],
		});

		expect(recipe).toEqual({
			kind: "text.file",
			path: "src/generated/crm.schemas.ts",
			mediaType: "text/x.typescript",
			disposition: "generated",
			text: [
				'import { z } from "zod";',
				"",
				"export const AccountSchema = z.object({});",
				"",
				"export type Account = typeof AccountSchema;",
				"",
			].join("\n"),
		});
	});

	test("applies TypeScript recipe invocations through registered recipe adapters", async () => {
		const recipe = await typescriptSyntaxRenderAdapter.render({
			unit: { nodeId: "syntax.unit:test.cli" },
			asset: {
				locator: { path: "src/generated/test-cli.ts" },
				mediaType: "text/x.typescript",
				disposition: "generated",
			},
			recipes: [
				{
					id: "typescript.recipe:test.cli.commander",
					value: {
						unit: "syntax.unit:test.cli",
						recipe: "commander.program",
						providerSelectionRequest: "test.cli.provider",
						order: 100,
					},
				},
			],
			selections: [
				{
					id: "test.cli.provider.test.recipe",
					request: "test.cli.provider",
					target: "syntax.unit:test.cli",
					role: "cli.program.syntax",
					provider: "provider.provider:test",
					adapter: "adapter.adapter:test.recipe",
				},
			],
			recipeAdapters: [
				{
					id: "test.recipe",
					kind: "typescript.module.recipe",
					capability: "capability.capability:typescript.recipe.apply",
					adapter: {
						async apply() {
							return {
								sourceText: "export const generated = true;\n",
							};
						},
					},
				},
			],
		});

		expect(recipe).toEqual({
			kind: "text.file",
			path: "src/generated/test-cli.ts",
			mediaType: "text/x.typescript",
			disposition: "generated",
			text: "export const generated = true;\n",
		});
	});
});
