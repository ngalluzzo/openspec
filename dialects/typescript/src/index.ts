import type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";
import { tsAdapter } from "@reforge/adapters/typescript";
import { parse, print } from "@reforge/core";
import type {
	TypeScriptDeclarationFacetContract,
	TypeScriptFunctionParameter,
	TypeScriptImportBinding,
	TypeScriptImportFacetContract,
	TypeScriptModuleEdit,
	TypeScriptObjectTypeProperty,
	TypeScriptRecipeApplyInput,
	TypeScriptRecipeApplyResult,
	TypeScriptRecipeInvocationContract,
	TypeScriptStatement,
	TypeScriptSyntaxRenderInput,
	TypeScriptTypeExpression,
	TypeScriptValueExpression,
} from "./sdk/typescript-dialect-types.generated.ts";
import {
	implementTypeScriptSyntaxRenderAdapter,
	type TypeScriptSyntaxRenderAdapter,
} from "./sdk/typescript-syntax-render.generated.ts";

type TypeScriptRecipeApplyAdapter = {
	apply(
		input: TypeScriptRecipeApplyInput,
	): Promise<TypeScriptRecipeApplyResult> | TypeScriptRecipeApplyResult;
};

type TypeScriptSyntaxRenderRuntimeInput = TypeScriptSyntaxRenderInput & {
	recipeAdapters?: Array<{
		id?: string;
		kind: string;
		capability?: string;
		adapter: unknown;
	}>;
};

export const typescriptSyntaxRenderAdapter: TypeScriptSyntaxRenderAdapter =
	implementTypeScriptSyntaxRenderAdapter({
		async render(
			input: TypeScriptSyntaxRenderRuntimeInput,
		): Promise<TextFileArtifactRecipe> {
			return {
				kind: "text.file",
				...(input.asset.locator?.path
					? { path: input.asset.locator.path }
					: {}),
				text: await renderSourceFile(input),
				mediaType: input.asset.mediaType ?? "text/x.typescript",
				...(input.asset.disposition
					? { disposition: input.asset.disposition }
					: { disposition: "generated" as const }),
			};
		},
	});

async function renderSourceFile(
	input: TypeScriptSyntaxRenderRuntimeInput,
): Promise<string> {
	const imports = uniqueBy(input.imports ?? [], (item) => item.id).map(
		(facet) => importFacetToModuleEdit(facet),
	);
	const declarations = uniqueBy(
		input.declarations ?? [],
		(item) => item.id,
	).map(declarationFacetToModuleEdit);
	const recipeResults = await renderRecipes(input);
	const moduleEdits = renderModuleEdits([
		...imports,
		...declarations,
		...recipeResults.edits,
	]);

	return formatTypeScript(
		[...moduleEdits, ...recipeResults.sourceTexts]
			.filter(Boolean)
			.join("\n\n")
			.concat("\n"),
	);
}

async function renderRecipes(
	input: TypeScriptSyntaxRenderRuntimeInput,
): Promise<{
	edits: TypeScriptModuleEdit[];
	sourceTexts: string[];
}> {
	const recipes = uniqueBy(input.recipes ?? [], (item) => item.id).sort(
		(a, b) =>
			(a.value.order ?? 0) - (b.value.order ?? 0) || a.id.localeCompare(b.id),
	);
	const recipeAdapters = input.recipeAdapters ?? [];
	const edits: TypeScriptModuleEdit[] = [];
	const sourceTexts: string[] = [];

	for (const recipe of recipes) {
		const adapter = resolveRecipeAdapter(
			recipe,
			recipeAdapters,
			input.selections ?? [],
		);
		const result = await adapter.apply({
			invocation: recipe,
			unit: input.unit,
			asset: input.asset,
		});
		if (hasErrorDiagnostics(result.diagnostics)) {
			throw new Error(
				`typescript.recipe.apply.failed: Recipe '${recipe.id}' returned error diagnostics.`,
			);
		}
		if (result.edits) edits.push(...result.edits);
		if (result.sourceText) sourceTexts.push(result.sourceText.trim());
	}

	return { edits, sourceTexts };
}

function resolveRecipeAdapter(
	recipe: TypeScriptRecipeInvocationContract,
	adapters: TypeScriptSyntaxRenderRuntimeInput["recipeAdapters"],
	selections: TypeScriptSyntaxRenderInput["selections"],
): TypeScriptRecipeApplyAdapter {
	const adapterId =
		adapterIdFromNodeId(recipe.value.adapter) ??
		adapterIdFromNodeId(
			resolveRecipeProviderSelection(recipe, selections)?.adapter,
		);
	if (adapterId) {
		const selected = (adapters ?? []).find((entry) => entry.id === adapterId);
		if (!selected || !isRecipeApplyAdapter(selected.adapter)) {
			throw new Error(
				`typescript.recipe.adapter.missing: Recipe '${recipe.id}' requires selected adapter '${adapterId}'.`,
			);
		}
		return selected.adapter;
	}
	const match = (adapters ?? []).find((entry) => {
		return entry.kind === recipe.value.recipe;
	});
	if (!match || !isRecipeApplyAdapter(match.adapter)) {
		throw new Error(
			`typescript.recipe.adapter.missing: Recipe '${recipe.id}' requires adapter '${recipe.value.adapter ?? recipe.value.recipe}'.`,
		);
	}
	return match.adapter;
}

function resolveRecipeProviderSelection(
	recipe: TypeScriptRecipeInvocationContract,
	selections: TypeScriptSyntaxRenderInput["selections"],
): { adapter?: string } | undefined {
	const request = recipe.value.providerSelectionRequest;
	if (!request) return undefined;
	return selections?.find(
		(selection) => selection.request === request || selection.id === request,
	);
}

function adapterIdFromNodeId(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const prefix = "adapter.adapter:";
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function isRecipeApplyAdapter(
	value: unknown,
): value is TypeScriptRecipeApplyAdapter {
	return typeof value === "object" && value !== null && "apply" in value;
}

function hasErrorDiagnostics(value: unknown): boolean {
	if (!Array.isArray(value)) return false;
	return value.some(
		(item) =>
			typeof item === "object" &&
			item !== null &&
			(item as { severity?: unknown }).severity === "error",
	);
}

function formatTypeScript(source: string): string {
	if (!source.trim()) return "";
	const parsed = parse(source, { adapter: tsAdapter });
	return print(parsed).code;
}

function renderModuleEdit(edit: TypeScriptModuleEdit): string {
	switch (edit.kind) {
		case "import":
			return renderImport(edit);
		case "typeAlias":
			return renderTypeAlias(edit);
		case "const":
			return renderConstDeclaration(edit);
		case "function":
			return renderFunctionDeclaration(edit);
		case "statement":
			return renderStatement(edit.statement);
		case "functionBodyStatement":
			return "";
		case "raw":
			return edit.text;
	}
}

function renderModuleEdits(edits: TypeScriptModuleEdit[]): string[] {
	const functionBodyEdits = edits
		.filter(
			(
				edit,
			): edit is Extract<
				TypeScriptModuleEdit,
				{ kind: "functionBodyStatement" }
			> => edit.kind === "functionBodyStatement",
		)
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	return edits
		.filter((edit) => edit.kind !== "functionBodyStatement")
		.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		.map((edit) =>
			edit.kind === "function"
				? renderModuleEdit(withFunctionBodyEdits(edit, functionBodyEdits))
				: renderModuleEdit(edit),
		);
}

function withFunctionBodyEdits(
	edit: Extract<TypeScriptModuleEdit, { kind: "function" }>,
	bodyEdits: Array<
		Extract<TypeScriptModuleEdit, { kind: "functionBodyStatement" }>
	>,
): Extract<TypeScriptModuleEdit, { kind: "function" }> {
	const matching = bodyEdits.filter((item) => item.functionName === edit.name);
	if (matching.length === 0) return edit;
	const insertions = matching.map((item) => item.statement);
	const body = [...edit.body];
	const trailingReturnIndex =
		body.length > 0 && body[body.length - 1]?.kind === "return"
			? body.length - 1
			: body.length;
	return {
		...edit,
		body: [
			...body.slice(0, trailingReturnIndex),
			...insertions,
			...body.slice(trailingReturnIndex),
		],
	};
}

function importFacetToModuleEdit(
	facet: TypeScriptImportFacetContract,
): TypeScriptModuleEdit {
	return {
		kind: "import",
		order: facet.value.order,
		module: facet.value.module,
		...(facet.value.named ? { named: facet.value.named } : {}),
		...(facet.value.default ? { default: facet.value.default } : {}),
		...(facet.value.namespace ? { namespace: facet.value.namespace } : {}),
	};
}

function declarationFacetToModuleEdit(
	facet: TypeScriptDeclarationFacetContract,
): TypeScriptModuleEdit {
	const value = facet.value;
	if (value.kind === "type" || value.kind === "typeAlias") {
		return {
			kind: "typeAlias",
			order: value.order,
			name: value.name,
			exported: value.exported,
			type: value.type ?? { kind: "keyword", name: "unknown" },
		};
	}
	if (value.kind === "const") {
		return {
			kind: "const",
			order: value.order,
			name: value.name,
			exported: value.exported,
			...(value.type ? { type: value.type } : {}),
			value: value.value ?? { kind: "raw", text: "undefined" },
		};
	}
	if (value.kind === "function") {
		return {
			kind: "function",
			order: value.order,
			name: value.name,
			exported: value.exported,
			parameters: value.parameters ?? [],
			...(value.returnType ? { returnType: value.returnType } : {}),
			body: value.body ?? [],
		};
	}
	return {
		kind: "raw",
		text: renderDeclaration(facet),
	};
}

function renderImport(value: TypeScriptImportFacetContract["value"]): string {
	const bindings: string[] = [];
	if (value.default) bindings.push(value.default);
	if (value.namespace) bindings.push(`* as ${value.namespace}`);
	if (value.named?.length) {
		bindings.push(`{ ${value.named.map(renderImportBinding).join(", ")} }`);
	}
	if (bindings.length === 0) return `import ${JSON.stringify(value.module)};`;
	return `import ${bindings.join(", ")} from ${JSON.stringify(value.module)};`;
}

function renderImportBinding(binding: TypeScriptImportBinding): string {
	return binding.local
		? `${binding.imported} as ${binding.local}`
		: binding.imported;
}

function renderDeclaration(facet: TypeScriptDeclarationFacetContract): string {
	const value = facet.value;
	const comment = value.comment ? `${renderComment(value.comment)}\n` : "";
	if (value.kind === "type" || value.kind === "typeAlias") {
		return `${comment}${renderTypeAlias({
			name: value.name,
			exported: value.exported,
			type: value.type ?? { kind: "keyword", name: "unknown" },
		})}`;
	}
	if (value.kind === "interface") {
		const body = renderInterfaceBody(
			value.type ?? { kind: "object", properties: [] },
		);
		return `${comment}${value.exported ? "export " : ""}interface ${value.name} ${body}`;
	}
	if (value.kind === "const") {
		return `${comment}${renderConstDeclaration({
			name: value.name,
			exported: value.exported,
			...(value.type ? { type: value.type } : {}),
			value: value.value ?? { kind: "raw", text: "undefined" },
		})}`;
	}
	if (value.kind === "function") {
		return `${comment}${renderFunctionDeclaration({
			name: value.name,
			exported: value.exported,
			parameters: value.parameters ?? [],
			...(value.returnType ? { returnType: value.returnType } : {}),
			body: value.body ?? [],
		})}`;
	}
	return `${comment}${value.exported ? "export " : ""}${renderValue(value.value ?? { kind: "raw", text: "" })}`;
}

function renderTypeAlias(value: {
	name: string;
	exported?: boolean;
	type: TypeScriptTypeExpression;
}): string {
	return `${value.exported ? "export " : ""}type ${value.name} = ${renderType(value.type)};`;
}

function renderConstDeclaration(value: {
	name: string;
	exported?: boolean;
	type?: TypeScriptTypeExpression;
	value: TypeScriptValueExpression;
}): string {
	const type = value.type ? `: ${renderType(value.type)}` : "";
	return `${value.exported ? "export " : ""}const ${value.name}${type} = ${renderValue(value.value)};`;
}

function renderFunctionDeclaration(value: {
	name: string;
	exported?: boolean;
	parameters?: TypeScriptFunctionParameter[];
	returnType?: TypeScriptTypeExpression;
	body: TypeScriptStatement[];
}): string {
	const parameters = renderParameters(value.parameters ?? []);
	const returnType = value.returnType
		? `: ${renderType(value.returnType)}`
		: "";
	return `${value.exported ? "export " : ""}function ${value.name}(${parameters})${returnType} ${renderBlock(value.body)}`;
}

function renderValue(value: TypeScriptValueExpression): string {
	switch (value.kind) {
		case "identifier":
			return value.name;
		case "member":
			return `${renderValue(value.object)}.${value.property}`;
		case "elementAccess":
			return `${renderValue(value.object)}[${renderValue(value.element)}]`;
		case "call":
			return `${renderValue(value.callee)}(${(value.arguments ?? []).map(renderValue).join(", ")})`;
		case "new":
			return `new ${renderValue(value.callee)}(${(value.arguments ?? []).map(renderValue).join(", ")})`;
		case "await":
			return `await ${renderValue(value.value)}`;
		case "unary":
			return `${value.operator}${renderValue(value.value)}`;
		case "object":
			return value.properties.length === 0
				? "{}"
				: `{ ${value.properties.map(renderObjectProperty).join(", ")} }`;
		case "array":
			return `[${value.items.map(renderValue).join(", ")}]`;
		case "literal":
			return JSON.stringify(value.value);
		case "arrowFunction":
			return `${value.async ? "async " : ""}(${renderParameters(value.parameters ?? [])}) => ${
				isStatementBlock(value.body)
					? renderBlock(value.body.statements)
					: renderValue(value.body)
			}`;
		case "raw":
			return value.text;
	}
}

function renderBlock(statements: TypeScriptStatement[]): string {
	if (statements.length === 0) return "{}";
	return `{\n${statements.map((statement) => indentLines(renderStatement(statement), "\t")).join("\n")}\n}`;
}

function renderStatement(statement: TypeScriptStatement): string {
	switch (statement.kind) {
		case "raw":
			return statement.text;
		case "const": {
			const type = statement.type ? `: ${renderType(statement.type)}` : "";
			return `const ${statement.name}${type} = ${renderValue(statement.value)};`;
		}
		case "expression":
			return `${renderValue(statement.expression)};`;
		case "return":
			return statement.value
				? `return ${renderValue(statement.value)};`
				: "return;";
		case "throw":
			return `throw ${renderValue(statement.value)};`;
		case "block":
			return renderBlock(statement.statements);
		case "if": {
			const elseBlock = statement.else?.length
				? ` else ${renderBlock(statement.else)}`
				: "";
			return `if (${renderValue(statement.condition)}) ${renderBlock(statement.then)}${elseBlock}`;
		}
		case "chainedCall":
			return renderChainedCallStatement(statement);
	}
}

function renderChainedCallStatement(
	statement: Extract<TypeScriptStatement, { kind: "chainedCall" }>,
): string {
	if (statement.calls.length === 0)
		return `${renderValue(statement.receiver)};`;
	return [
		renderValue(statement.receiver),
		...statement.calls.map(
			(call) =>
				`\t.${call.method}(${(call.arguments ?? []).map(renderValue).join(", ")})`,
		),
	]
		.join("\n")
		.concat(";");
}

function isStatementBlock(
	value:
		| TypeScriptValueExpression
		| { kind: "block"; statements: TypeScriptStatement[] },
): value is { kind: "block"; statements: TypeScriptStatement[] } {
	return value.kind === "block";
}

function renderType(value: TypeScriptTypeExpression): string {
	switch (value.kind) {
		case "keyword":
			return value.name;
		case "ref":
			return value.name;
		case "array":
			return `${renderType(value.item)}[]`;
		case "object":
			return renderObjectType(value.properties);
		case "record":
			return `Record<${renderType(value.key)}, ${renderType(value.value)}>`;
		case "union":
			return value.options.map(renderType).join(" | ");
		case "intersection":
			return value.options.map(renderType).join(" & ");
		case "literal":
			return JSON.stringify(value.value);
		case "promise":
			return `Promise<${renderType(value.value)}>`;
		case "typeQuery":
			return `typeof ${renderValue(value.expression)}`;
		case "typeApplication":
			return `${renderType(value.base)}<${value.arguments
				.map(renderType)
				.join(", ")}>`;
		case "function":
			return `(${renderParameters(value.parameters)}) => ${renderType(value.returnType)}`;
		case "raw":
			return value.text;
	}
}

function renderObjectProperty(property: {
	key: string;
	value: TypeScriptValueExpression;
}): string {
	return `${quoteProperty(property.key)}: ${renderValue(property.value)}`;
}

function renderInterfaceBody(value: TypeScriptTypeExpression): string {
	if (value.kind !== "object") return `{ ${renderType(value)} }`;
	return renderObjectType(value.properties);
}

function renderObjectType(properties: TypeScriptObjectTypeProperty[]): string {
	if (properties.length === 0) return "{}";
	return `{ ${properties.map(renderObjectTypeProperty).join(" ")} }`;
}

function renderObjectTypeProperty(
	property: TypeScriptObjectTypeProperty,
): string {
	const prefix = property.readonly ? "readonly " : "";
	const optional = property.optional ? "?" : "";
	return `${prefix}${quoteProperty(property.name)}${optional}: ${renderType(property.type)};`;
}

function renderParameters(parameters: TypeScriptFunctionParameter[]): string {
	return parameters.map(renderParameter).join(", ");
}

function renderParameter(parameter: TypeScriptFunctionParameter): string {
	const rest = parameter.rest ? "..." : "";
	const optional = parameter.optional ? "?" : "";
	const type = parameter.type ? `: ${renderType(parameter.type)}` : "";
	return `${rest}${parameter.name}${optional}${type}`;
}

function renderComment(value: string): string {
	const lines = value.split(/\r?\n/);
	if (lines.length === 1) return `/** ${lines[0]} */`;
	return ["/**", ...lines.map((line) => ` * ${line}`), " */"].join("\n");
}

function indentLines(value: string, prefix: string): string {
	return value
		.split("\n")
		.map((line) => `${prefix}${line}`)
		.join("\n");
}

function quoteProperty(value: string): string {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value)
		? value
		: JSON.stringify(value);
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
	const seen = new Set<string>();
	const result: T[] = [];
	for (const item of items) {
		const value = key(item);
		if (seen.has(value)) continue;
		seen.add(value);
		result.push(item);
	}
	return result;
}
