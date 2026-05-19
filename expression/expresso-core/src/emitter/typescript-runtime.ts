import { TYPESCRIPT_EXPRESSION_TARGET } from "./targets";
import type {
	ExpressionEmitRequest,
	ExpressionEmitterTarget,
	ExpressionTargetEmitter,
} from "./types";

export interface CreateTypeScriptRuntimeEmitterOptions {
	readonly id?: string;
	readonly importSource: string;
	readonly importName?: string;
	readonly target?: ExpressionEmitterTarget;
}

function getBindingReference(
	request: ExpressionEmitRequest,
	slot: string,
): string | undefined {
	return request.bindings?.find((binding) => binding.slot === slot)?.reference;
}

export function createTypeScriptRuntimeEmitter(
	options: CreateTypeScriptRuntimeEmitterOptions,
): ExpressionTargetEmitter {
	const importName = options.importName ?? "applyStandard";
	const target = options.target ?? TYPESCRIPT_EXPRESSION_TARGET;
	const emitterId =
		options.id ??
		`expresso.emitter.typescript.runtime.${options.importSource}.${importName}`;

	return Object.freeze({
		id: emitterId,
		targets: Object.freeze([target]),
		emit(request: ExpressionEmitRequest) {
			const rootReference = getBindingReference(request, "root") ?? "undefined";

			return Object.freeze({
				emitterId,
				target,
				strategy: "runtime-backed" as const,
				source: `${importName}(${JSON.stringify(request.expression)}, ${rootReference})`,
				imports: Object.freeze([
					Object.freeze({
						kind: "named-import" as const,
						from: options.importSource,
						names: Object.freeze([importName]),
					}),
				]),
				guarantees: Object.freeze([
					Object.freeze({
						code: "runtime-evaluation",
						message:
							"Expression is evaluated through the canonical runtime for this target.",
					}),
				]),
			});
		},
	});
}
