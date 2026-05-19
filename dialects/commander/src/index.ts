import type {
	TypeScriptModuleEdit,
	TypeScriptStatement,
	TypeScriptValueExpression,
} from "@openspec/typescript-dialect/types";
import {
	implementTypeScriptRecipeApplyAdapter,
	type TypeScriptRecipeApplyAdapter,
} from "@openspec/typescript-recipe-apply-capability";
import type {
	CommanderCommandContract,
	CommanderCommandOptionContract,
	CommanderProgramContract,
	CommanderProgramRecipeInput,
} from "./sdk/commander-dialect-types.generated.ts";

export const commanderProgramRecipeAdapter: TypeScriptRecipeApplyAdapter =
	implementTypeScriptRecipeApplyAdapter({
		async apply(input) {
			if (input.invocation.value.inputModel !== "model:CommanderProgramRecipeInput") {
				return {
					diagnostics: [
						{
							code: "commander.program.recipe.inputModel.invalid",
							message:
								"Commander program recipe invocation must declare inputModel model:CommanderProgramRecipeInput.",
							severity: "error",
						},
					],
				};
			}
			const recipeInput = input.invocation.value.input as
				| CommanderProgramRecipeInput
				| undefined;
			if (!recipeInput?.program) {
				return {
					diagnostics: [
						{
							code: "commander.program.recipe.input.missing",
							message:
								"Commander program recipe invocation did not include input.program.",
							severity: "error",
						},
					],
				};
			}

			return {
				edits: commanderBindingEdits(recipeInput.program),
			};
		},
	});

function commanderBindingEdits(
	program: CommanderProgramContract,
): TypeScriptModuleEdit[] {
	return [
		bodyStatement(program.factoryName, 10, programMetadataStatement(program)),
		...program.commands.map((command, index) =>
			bodyStatement(program.factoryName, 100 + index, commandStatement(command)),
		),
	];
}

function bodyStatement(
	functionName: string,
	order: number,
	statement: TypeScriptStatement,
): TypeScriptModuleEdit {
	return {
		kind: "functionBodyStatement",
		functionName,
		order,
		statement,
	};
}

function programMetadataStatement(program: CommanderProgramContract): TypeScriptStatement {
	return {
		kind: "chainedCall",
		receiver: { kind: "identifier", name: "program" },
		calls: [
			{
				method: "name",
				arguments: [literal(program.programName)],
			},
			...(program.description
				? [
						{
							method: "description",
							arguments: [literal(program.description)],
						},
					]
				: []),
		],
	};
}

function commandStatement(command: CommanderCommandContract): TypeScriptStatement {
	return {
		kind: "chainedCall",
		receiver: { kind: "identifier", name: "program" },
		calls: [
			{
				method: "command",
				arguments: [literal(command.command)],
			},
			...(command.description
				? [
						{
							method: "description",
							arguments: [literal(command.description)],
						},
					]
				: []),
			...command.options.map((option) => ({
				method: "option",
				arguments: optionArguments(option),
			})),
			{
				method: "action",
				arguments: [{ kind: "identifier", name: command.actionName }],
			},
		],
	};
}

function optionArguments(
	option: CommanderCommandOptionContract,
): TypeScriptValueExpression[] {
	return [
		literal(option.flag),
		literal(option.description ?? option.name),
		...(option.defaultValue !== undefined && option.defaultValue !== null
			? [literal(option.defaultValue)]
			: []),
	];
}

function literal(value: unknown): TypeScriptValueExpression {
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return { kind: "literal", value };
	}
	return { kind: "literal", value: JSON.stringify(value) };
}
