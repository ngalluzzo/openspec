import type { ValidationSchema } from "../runtime/contracts/types";
import type { OperatorRegistry } from "./registry";

/**
 * OperatorSignature contract.
 */
export interface OperatorSignature {
	/** id value. */
	readonly id: string;
	/** aliases value. */
	readonly aliases: readonly string[];
	/** async value. */
	readonly async: boolean;
	/** eager value. */
	readonly eager: boolean;
	/** hasInputSchema value. */
	readonly hasInputSchema: boolean;
	/** hasOutputSchema value. */
	readonly hasOutputSchema: boolean;
	/** inputSchema value. */
	readonly inputSchema?: ValidationSchema;
	/** outputSchema value. */
	readonly outputSchema?: ValidationSchema;
	/** metadata value. */
	readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * ListOperatorSignaturesOptions contract.
 */
export interface ListOperatorSignaturesOptions {
	readonly operatorRegistry: OperatorRegistry;
	/** includeSchemas value. */
	readonly includeSchemas?: boolean;
}

/**
 * Lists operator signatures.
 *
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `listOperatorSignatures`.
 *
 * @example
 * listOperatorSignatures(options);
 */

export function listOperatorSignatures(
	options: ListOperatorSignaturesOptions,
): readonly OperatorSignature[] {
	const byId = new Map<string, OperatorSignature>();
	const operators = options.operatorRegistry.getAll();

	for (const [name, operator] of operators) {
		const id = operator.metadata?.id ?? name;
		const aliases =
			operator.metadata?.aliases?.filter((alias) => alias !== id) ?? [];

		if (byId.has(id)) {
			continue;
		}

		const includeSchemas = options.includeSchemas === true;

		byId.set(id, {
			id,
			aliases,
			async: operator.async === true,
			eager: operator.eager === true,
			hasInputSchema: operator.inputSchema !== undefined,
			hasOutputSchema: operator.outputSchema !== undefined,
			...(includeSchemas &&
				operator.inputSchema !== undefined && {
					inputSchema: operator.inputSchema,
				}),
			...(includeSchemas &&
				operator.outputSchema !== undefined && {
					outputSchema: operator.outputSchema,
				}),
			...(operator.metadata && {
				metadata: operator.metadata as unknown as Readonly<
					Record<string, unknown>
				>,
			}),
		});
	}

	return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}
