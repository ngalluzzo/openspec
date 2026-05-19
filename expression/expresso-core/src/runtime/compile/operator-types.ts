import type { ValidationSchema } from "../contracts/types";

/**
 * OperatorTypeDescriptor contract.
 */
export interface OperatorTypeDescriptor<
	Id extends string,
	Args extends readonly unknown[],
	Out,
	IsAsync extends boolean = false,
> {
	/** id value. */
	readonly id: Id;
	/** async value. */
	readonly async?: IsAsync;
	/** aliases value. */
	readonly aliases?: readonly string[];
	/** inputSchema value. */
	readonly inputSchema?: ValidationSchema;
	/** outputSchema value. */
	readonly outputSchema?: ValidationSchema;
}

/**
 * OperatorTypeRegistry contract.
 */
export interface OperatorTypeRegistry<
	TDescriptors extends readonly OperatorTypeDescriptor<
		string,
		readonly unknown[],
		unknown,
		boolean
	>[],
> {
	/** descriptors value. */
	readonly descriptors: TDescriptors;
	/** byId value. */
	readonly byId: ReadonlyMap<TDescriptors[number]["id"], TDescriptors[number]>;
	get<TId extends TDescriptors[number]["id"]>(
		id: TId,
	): Extract<TDescriptors[number], { readonly id: TId }> | undefined;
}

/**
 * OperatorTypeRegistryLike contract.
 */
export type OperatorTypeRegistryLike = OperatorTypeRegistry<
	readonly OperatorTypeDescriptor<
		string,
		readonly unknown[],
		unknown,
		boolean
	>[]
>;

/**
 * OperatorId contract.
 */
export type OperatorId<TRegistry extends OperatorTypeRegistryLike> =
	TRegistry["descriptors"][number]["id"];

type DescriptorOf<
	TRegistry extends OperatorTypeRegistryLike,
	TId extends OperatorId<TRegistry>,
> = Extract<TRegistry["descriptors"][number], { readonly id: TId }>;

/**
 * ArgsOf contract.
 */
export type ArgsOf<
	TRegistry extends OperatorTypeRegistryLike,
	TId extends OperatorId<TRegistry>,
> =
	DescriptorOf<TRegistry, TId> extends OperatorTypeDescriptor<
		string,
		infer TArgs,
		unknown,
		boolean
	>
		? TArgs
		: never;

/**
 * OutputOf contract.
 */
export type OutputOf<
	TRegistry extends OperatorTypeRegistryLike,
	TId extends OperatorId<TRegistry>,
> =
	DescriptorOf<TRegistry, TId> extends OperatorTypeDescriptor<
		string,
		readonly unknown[],
		infer TOut,
		boolean
	>
		? TOut
		: never;

/**
 * Creates operator type registry.
 *
 * @param descriptors - The `descriptors` argument value.
 *
 * @returns The result produced by `createOperatorTypeRegistry`.
 *
 * @example
 * createOperatorTypeRegistry(descriptors);
 */

export function createOperatorTypeRegistry<
	const TDescriptors extends readonly OperatorTypeDescriptor<
		string,
		readonly unknown[],
		unknown,
		boolean
	>[],
>(descriptors: TDescriptors): OperatorTypeRegistry<TDescriptors> {
	const byId = new Map<TDescriptors[number]["id"], TDescriptors[number]>();

	for (const descriptor of descriptors) {
		byId.set(descriptor.id, descriptor);
	}

	return {
		descriptors,
		byId,
		get<TId extends TDescriptors[number]["id"]>(id: TId) {
			return byId.get(id) as
				| Extract<TDescriptors[number], { readonly id: TId }>
				| undefined;
		},
	};
}
