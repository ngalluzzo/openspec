import type {
	OperatorHandler,
	ValidationSchema,
} from "../runtime/contracts/types";
import type { OperatorMetadata } from "../types/metadata";
import type { OperatorRegistry } from "./registry";
import { getDefaultOperatorRegistry } from "./registry";

type BaseOperatorOptions = {
	readonly metadata: Omit<OperatorMetadata, "id" | "version">;
	readonly eager?: boolean;
};

type DefineSyncOperatorOptions<
	TInput = any[],
	TOutput = unknown,
> = BaseOperatorOptions & {
	readonly handler: OperatorHandler<TInput, TOutput>;
	readonly inputSchema?: ValidationSchema;
	readonly outputSchema?: ValidationSchema;
};

type DefineAsyncOperatorOptions<
	TInput = any[],
	TOutput = unknown,
> = BaseOperatorOptions & {
	readonly handler: OperatorHandler<TInput, Promise<TOutput>>;
	readonly inputSchema?: ValidationSchema;
	readonly outputSchema?: ValidationSchema;
};

/**
 * Executes `defineSyncOperator` with the provided inputs.
 *
 * @param id - The `id` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `defineSyncOperator`.
 *
 * @example
 * defineSyncOperator(id, options);
 */

export function defineSyncOperator<TInput = any[], TOutput = unknown>(
	id: string,
	options: DefineSyncOperatorOptions<TInput, TOutput>,
): (operatorRegistry: OperatorRegistry) => void {
	const { handler, inputSchema, outputSchema, metadata, eager } = options;

	const fullMetadata: OperatorMetadata = {
		id,
		version: "1.0.0",
		...metadata,
	};

	return (operatorRegistry = getDefaultOperatorRegistry()) =>
		operatorRegistry.registerSync(id, handler, {
			...(inputSchema !== undefined && { inputSchema }),
			...(outputSchema !== undefined && { outputSchema }),
			eager: eager ?? fullMetadata.eager ?? false,
			metadata: fullMetadata,
		});
}

/**
 * Executes `defineAsyncOperator` with the provided inputs.
 *
 * @param id - The `id` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `defineAsyncOperator`.
 *
 * @example
 * defineAsyncOperator(id, options);
 */

export function defineAsyncOperator<TInput = any[], TOutput = unknown>(
	id: string,
	options: DefineAsyncOperatorOptions<TInput, TOutput>,
): (operatorRegistry: OperatorRegistry) => void {
	const { handler, inputSchema, outputSchema, metadata, eager } = options;

	const fullMetadata: OperatorMetadata = {
		id,
		version: "1.0.0",
		...metadata,
	};

	return (operatorRegistry = getDefaultOperatorRegistry()) =>
		operatorRegistry.registerAsync(id, handler, {
			...(inputSchema !== undefined && { inputSchema }),
			...(outputSchema !== undefined && { outputSchema }),
			eager: eager ?? fullMetadata.eager ?? false,
			metadata: fullMetadata,
		});
}

/**
 * Executes `defineOperators` with the provided inputs.
 *
 * @param definitions - The `definitions` argument value.
 *
 * @returns The result produced by `defineOperators`.
 *
 * @example
 * defineOperators(definitions);
 */

export function defineOperators(
	definitions: Record<
		string,
		{
			readonly handler: (...args: readonly unknown[]) => unknown;
			readonly inputSchema?: ValidationSchema;
			readonly outputSchema?: ValidationSchema;
			readonly metadata: Omit<OperatorMetadata, "id" | "version">;
			readonly eager?: boolean;
			readonly async?: boolean;
		}
	>,
): Record<string, (operatorRegistry: OperatorRegistry) => void> {
	const registrations: Record<
		string,
		(operatorRegistry: OperatorRegistry) => void
	> = {};
	for (const [id, options] of Object.entries(definitions)) {
		registrations[id] = options.async
			? defineAsyncOperator(id, options as DefineAsyncOperatorOptions)
			: defineSyncOperator(id, options as DefineSyncOperatorOptions);
	}
	return registrations;
}

/**
 * Creates operator options.
 *
 * @param id - The `id` argument value.
 * @param handler - The `handler` argument value.
 * @param metadata - The `metadata` argument value.
 *
 * @returns The result produced by `createOperatorOptions`.
 *
 * @example
 * createOperatorOptions(id, handler, metadata);
 */

export function createOperatorOptions<_TInput = unknown, TOutput = unknown>(
	id: string,
	handler: (...args: unknown[]) => TOutput,
	metadata?: {
		name?: string;
		title?: string;
		description?: string;
		category?: string;
		tags?: string[];
		examples?: Array<{
			description: string;
			input: Record<string, unknown>;
			rule: Record<string, unknown>;
			output: TOutput;
		}>;
		complexity?: string;
		performanceNotes?: string;
		jsonlogicCompatible?: boolean;
	},
) {
	return {
		id,
		handler,
		...(metadata && {
			metadata: {
				id,
				version: "1.0.0",
				name: metadata.name || id,
				title: metadata.title || id,
				description: metadata.description || "",
				category: metadata.category || "misc",
				tags: metadata.tags || [],
				examples: metadata.examples || [],
				...(metadata.complexity && { complexity: metadata.complexity }),
				...(metadata.performanceNotes && {
					performanceNotes: metadata.performanceNotes,
				}),
				...(metadata.jsonlogicCompatible !== undefined && {
					jsonlogicCompatible: metadata.jsonlogicCompatible,
				}),
			},
		}),
	};
}
