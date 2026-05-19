import * as ts from "typescript";
import type { TypeScriptNativeEmitterContext } from "./contracts";
import { UnsupportedTypeScriptExpressionError } from "./errors";

const SOURCE_FILE = ts.createSourceFile(
	"expresso-expression.ts",
	"",
	ts.ScriptTarget.Latest,
	false,
	ts.ScriptKind.TS,
);

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export function createIdentifier(name: string): ts.Identifier {
	return ts.factory.createIdentifier(name);
}

export function parseTypeScriptExpression(source: string): ts.Expression {
	const file = ts.createSourceFile(
		"expresso-binding.ts",
		`const __openspec_binding = (${source});`,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const statement = file.statements[0];
	if (
		!statement ||
		!ts.isVariableStatement(statement) ||
		statement.declarationList.declarations.length !== 1
	) {
		throw new Error(`Unable to parse TypeScript expression binding: ${source}`);
	}

	const initializer = statement.declarationList.declarations[0]?.initializer;
	if (!initializer) {
		throw new Error(`Unable to parse TypeScript expression binding: ${source}`);
	}

	return initializer;
}

export function printTypeScriptExpression(expression: ts.Expression): string {
	return ts
		.createPrinter()
		.printNode(ts.EmitHint.Expression, expression, SOURCE_FILE);
}

export function addNamedImport(
	context: TypeScriptNativeEmitterContext,
	from: string,
	name: string,
): void {
	const existing = context.imports.get(from) ?? new Set<string>();
	existing.add(name);
	context.imports.set(from, existing);
}

export function createHelperCall(
	context: TypeScriptNativeEmitterContext,
	name: string,
	args: readonly ts.Expression[],
): ts.Expression {
	addNamedImport(context, context.helperImportSource, name);
	return ts.factory.createCallExpression(createIdentifier(name), undefined, [
		...args,
	]);
}

export function createStringCoercion(expression: ts.Expression): ts.Expression {
	return ts.factory.createCallExpression(
		createIdentifier("String"),
		undefined,
		[
			ts.factory.createBinaryExpression(
				expression,
				ts.SyntaxKind.QuestionQuestionToken,
				ts.factory.createStringLiteral(""),
			),
		],
	);
}

export function createDefaultTruthiness(
	expression: ts.Expression,
): ts.Expression {
	return ts.factory.createCallExpression(
		createIdentifier("Boolean"),
		undefined,
		[expression],
	);
}

export function assertSupportedPath(path: string): void {
	if (path === "" || path === ".") {
		return;
	}

	if (path.startsWith("../") || path.startsWith("@")) {
		throw new UnsupportedTypeScriptExpressionError(
			`Path "${path}" requires scoped runtime semantics`,
		);
	}

	for (const segment of path.split(".")) {
		if (segment.length === 0 || UNSAFE_PATH_SEGMENTS.has(segment)) {
			throw new UnsupportedTypeScriptExpressionError(
				`Path "${path}" contains an unsupported segment`,
			);
		}

		if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) && !/^\d+$/.test(segment)) {
			throw new UnsupportedTypeScriptExpressionError(
				`Path "${path}" contains a non-emittable segment`,
			);
		}
	}
}
