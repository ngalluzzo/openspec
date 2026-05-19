import { TYPESCRIPT_EXPRESSION_TARGET } from "../targets";
import type { ExpressionEmitRequest, ExpressionTargetEmitter } from "../types";
import { parseTypeScriptExpression, printTypeScriptExpression } from "./ast";
import type {
	CreateTypeScriptNativeEmitterOptions,
	TypeScriptNativeEmitterContext,
} from "./contracts";
import { UnsupportedTypeScriptExpressionError } from "./errors";
import { lowerTypeScriptNativeExpression } from "./lower";

function buildNativeExpression(
	request: ExpressionEmitRequest,
	helperImportSource: string,
): {
	source: string;
	imports: readonly { from: string; names: readonly string[] }[];
} {
	const rootBinding =
		request.bindings?.find((binding) => binding.slot === "root")?.reference ??
		"undefined";

	const context: TypeScriptNativeEmitterContext = {
		helperImportSource,
		imports: new Map<string, Set<string>>(),
		rootReference: parseTypeScriptExpression(rootBinding),
	};

	const expression = lowerTypeScriptNativeExpression(
		request.expression,
		context,
	);

	return Object.freeze({
		source: printTypeScriptExpression(expression),
		imports: Object.freeze(
			[...context.imports.entries()]
				.sort((left, right) => left[0].localeCompare(right[0]))
				.map(([from, names]) =>
					Object.freeze({
						from,
						names: Object.freeze(
							[...names].sort((left, right) => left.localeCompare(right)),
						),
					}),
				),
		),
	});
}

export function createTypeScriptNativeEmitter(
	options: CreateTypeScriptNativeEmitterOptions,
): ExpressionTargetEmitter {
	const target = options.target ?? TYPESCRIPT_EXPRESSION_TARGET;
	const emitterId = options.id ?? "expresso.standard.typescript.native";

	return Object.freeze({
		id: emitterId,
		targets: Object.freeze([target]),
		supports(request: ExpressionEmitRequest) {
			try {
				buildNativeExpression(request, options.helperImportSource);
				return true;
			} catch (error) {
				if (error instanceof UnsupportedTypeScriptExpressionError) {
					return {
						supported: false,
						reason: error.message,
					};
				}

				throw error;
			}
		},
		emit(request: ExpressionEmitRequest) {
			const emitted = buildNativeExpression(
				request,
				options.helperImportSource,
			);
			return Object.freeze({
				emitterId,
				target,
				strategy: "native" as const,
				source: emitted.source,
				imports: Object.freeze(
					emitted.imports.map((entry) =>
						Object.freeze({
							kind: "named-import" as const,
							from: entry.from,
							names: entry.names,
						}),
					),
				),
				guarantees: Object.freeze([
					Object.freeze({
						code: "native-typescript-ast",
						message:
							"Expression was lowered to a TypeScript AST and printed without whole-rule runtime interpretation.",
					}),
				]),
			});
		},
	});
}
