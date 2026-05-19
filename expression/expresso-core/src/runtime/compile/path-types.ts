type PrimitiveLike =
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined;

type NativeObjectLike =
	| PrimitiveLike
	| Date
	| RegExp
	| ((...args: unknown[]) => unknown);

type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type JoinPath<Head extends string, Tail extends string> = `${Head}.${Tail}`;

type PathForArray<T, Depth extends number> = Depth extends 0
	? never
	: T extends readonly (infer TValue)[]
		?
				| `${number}`
				| JoinPath<`${number}`, PathInternal<TValue, PrevDepth[Depth]>>
		: never;

type PathForObject<T, Depth extends number> = Depth extends 0
	? never
	: T extends object
		? {
				[K in Extract<keyof T, string>]:
					| K
					| JoinPath<K, PathInternal<T[K], PrevDepth[Depth]>>;
			}[Extract<keyof T, string>]
		: never;

type PathInternal<T, Depth extends number> = T extends NativeObjectLike
	? never
	: PathForArray<T, Depth> | PathForObject<T, Depth>;

/**
 * Dot-notation paths over `TData` up to `MaxDepth`.
 */
export type Path<TData, MaxDepth extends number = 5> = PathInternal<
	TData,
	MaxDepth
>;

type SegmentValue<
	TData,
	Segment extends string,
> = TData extends readonly (infer TValue)[]
	? Segment extends `${number}`
		? TValue
		: never
	: Segment extends keyof TData
		? TData[Segment]
		: TData extends Record<string, infer DynamicValue>
			? DynamicValue
			: never;

/**
 * Resolves a dot-notation `Path` into its value type on `TData`.
 */
export type PathValue<
	TData,
	TPath extends string,
> = TPath extends `${infer Head}.${infer Tail}`
	? PathValue<SegmentValue<TData, Head>, Tail>
	: SegmentValue<TData, TPath>;
