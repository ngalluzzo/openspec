import type { GraphRuntime } from "@openspec/kernel";

export function runSelector<TResult = unknown, TInput = unknown>(
	runtime: GraphRuntime,
	selector: string,
	input: TInput,
): TResult {
	return runtime.select(selector, input);
}
