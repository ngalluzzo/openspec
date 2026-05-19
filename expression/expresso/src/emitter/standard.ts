import { ExpressionEmitterRegistry } from "@gooi/expresso-core/emitter/registry";
import { createTypeScriptNativeEmitter } from "@gooi/expresso-core/emitter/typescript-native";
import { createTypeScriptRuntimeEmitter } from "@gooi/expresso-core/emitter/typescript-runtime";

export function registerStandardEmitters(
	registry: ExpressionEmitterRegistry,
): ExpressionEmitterRegistry {
	registry.register(
		createTypeScriptNativeEmitter({
			id: "expresso.standard.typescript.native",
			helperImportSource: "@gooi/expresso/emitter/runtime",
		}),
	);

	registry.register(
		createTypeScriptRuntimeEmitter({
			id: "expresso.standard.typescript.runtime",
			importSource: "@gooi/expresso",
		}),
	);

	return registry;
}

export function createStandardEmitterRegistry(): ExpressionEmitterRegistry {
	return registerStandardEmitters(new ExpressionEmitterRegistry());
}
