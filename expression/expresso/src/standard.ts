import {
	apply,
	createOperatorRegistry,
	type EvaluationOptions,
	type OperatorRegistry,
	type Rule,
} from "@gooi/expresso-core";
import { stdPlugins } from "@gooi/expresso-std";

let cachedStandardOperatorRegistry: OperatorRegistry | undefined;

export function createStandardOperatorRegistry(): OperatorRegistry {
	const operatorRegistry = createOperatorRegistry();

	for (const plugin of stdPlugins) {
		const result = plugin.register({ operatorRegistry });
		if (result instanceof Promise) {
			throw new Error(
				`Standard plugin "${plugin.name}" requires async registration. Use an async registry initializer instead.`,
			);
		}
	}

	return operatorRegistry;
}

export function getStandardOperatorRegistry(): OperatorRegistry {
	if (!cachedStandardOperatorRegistry) {
		cachedStandardOperatorRegistry = createStandardOperatorRegistry();
	}

	return cachedStandardOperatorRegistry;
}

export function applyStandard<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: Omit<EvaluationOptions, "operatorRegistry">,
): TOutput {
	return apply(rule, data, {
		...options,
		operatorRegistry: getStandardOperatorRegistry(),
	});
}
