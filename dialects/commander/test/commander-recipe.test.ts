import { describe, expect, test } from "bun:test";
import { commanderProgramRecipeAdapter } from "../src/index.ts";

describe("commander program recipe adapter", () => {
	test("renders a Commander program from a recipe invocation contract", async () => {
		const result = await commanderProgramRecipeAdapter.apply({
			invocation: {
				id: "typescript.recipe:test.cli.commander",
				value: {
					inputModel: "model:CommanderProgramRecipeInput",
					input: {
						program: {
							id: "test.cli",
							factoryName: "createTestCliProgram",
							programName: "test",
							description: "Test CLI",
							commands: [
								{
									id: "test.build.cli",
									command: "build",
									description: "Build test workspace",
									actionName: "testBuildAction",
									options: [
										{
											name: "root",
											flag: "--root <value>",
											valueType: "string",
											description: "Workspace root",
										},
									],
								},
							],
						},
					},
				},
			},
			unit: {},
			asset: {},
		});

		expect(result.sourceText).toBeUndefined();
		expect(result.edits).toContainEqual(
			expect.objectContaining({
				kind: "functionBodyStatement",
				functionName: "createTestCliProgram",
				statement: expect.objectContaining({ kind: "chainedCall" }),
			}),
		);
		expect(result.edits).toContainEqual(
			expect.objectContaining({
				kind: "functionBodyStatement",
				functionName: "createTestCliProgram",
				statement: expect.objectContaining({
					calls: expect.arrayContaining([
						expect.objectContaining({
							method: "action",
							arguments: [expect.objectContaining({ name: "testBuildAction" })],
						}),
					]),
				}),
			}),
		);
	});
});
