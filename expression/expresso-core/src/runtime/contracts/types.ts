import type { OperatorRegistry } from "../../operators/registry";
import type { OperatorMetadata } from "../../types/metadata";

/**
 * Primitive contract.
 */
export type Primitive = string | number | boolean | null;
/**
 * JsonObject contract.
 */
export type JsonObject = { readonly [key: string]: JsonValue };
/**
 * JsonArray contract.
 */
export type JsonArray = readonly JsonValue[];
/**
 * JsonValue contract.
 */
export type JsonValue = Primitive | JsonObject | JsonArray;

/**
 * DataMarker contract.
 */
export type DataMarker = {
	readonly "@data": unknown;
};

/**
 * TruthinessMode contract.
 */
export type TruthinessMode = "default" | "jsonlogic" | "python" | "strict";

/**
 * Canonical Expresso rule AST envelope.
 *
 * @remarks
 * Rules allow nested operator nodes, primitive literals, arrays, and the
 * `@data` marker for embedded literal payloads.
 */
export type Rule =
	| {
			readonly [operator: string]:
				| Rule
				| readonly Rule[]
				| Primitive
				| readonly Primitive[];
	  }
	| readonly Rule[]
	| Primitive
	| DataMarker;

/**
 * OperatorHandler contract.
 */
export type ValidationResult =
	| {
			readonly success: true;
			readonly data: unknown;
	  }
	| {
			readonly success: false;
			readonly error: {
				readonly message: string;
			};
	  };

/**
 * Runtime validation schema contract.
 *
 * @remarks
 * Operators can use Zod or any compatible validator. The runtime deliberately
 * stores schemas behind this structural contract so operator registration does
 * not force TypeScript to retain and compare every Zod generic in the standard
 * library.
 */
export type ValidationSchema = {
	readonly safeParse: (input: unknown) => ValidationResult;
	readonly parse?: (input: unknown) => unknown;
};

export type OperatorHandler<TInput = unknown, TOutput = unknown> = (
	args: TInput,
	data: unknown,
	ctx: EvaluationContext,
) => TOutput;

/**
 * Operator contract.
 */
export type Operator<TInput = unknown, TOutput = unknown> = {
	readonly handler: OperatorHandler<TInput, TOutput>;
	readonly inputSchema?: ValidationSchema;
	readonly outputSchema?: ValidationSchema;
	/** Runs with unevaluated arguments when `false` and `lazy` execution is enabled. */
	readonly eager?: boolean;
	readonly async?: boolean;
	/** Preserves nested operator-shaped values as literals instead of evaluating them. */
	readonly preserveRules?: boolean;
	/** Preserves non-static arrays as raw values during argument evaluation. */
	readonly preserveRawArrays?: boolean;
	readonly metadata?: OperatorMetadata;
};

/**
 * IterationMetadata contract.
 */
export type IterationMetadata = {
	readonly index: number;
	readonly total: number;
	readonly first: boolean;
	readonly last: boolean;
};

/**
 * Scope contract.
 */
export type Scope = {
	readonly data: unknown;
	readonly iteration?: IterationMetadata;
};

/**
 * Runtime evaluation context threaded through recursive rule execution.
 */
export type EvaluationContext = {
	readonly operatorRegistry: OperatorRegistry;
	readonly lazy?: boolean;
	readonly debug?: boolean;
	depth: number;
	readonly maxDepth: number;
	trace?: EvaluationTrace[];
	readonly operator?: string;
	readonly scopes?: readonly Scope[];
	caughtErrors?: CaughtErrorTrace[];
	readonly strictErrors?: boolean;
	readonly truthinessMode?: TruthinessMode;
};

/**
 * EvaluationTrace contract.
 */
export type EvaluationTrace = {
	readonly depth: number;
	readonly operator: string;
	readonly args: readonly unknown[];
	readonly result: unknown;
	readonly timestamp: number;
};

/**
 * CaughtErrorTrace contract.
 */
export type CaughtErrorTrace = {
	readonly depth: number;
	readonly operator: string;
	readonly error: {
		readonly code: string;
		readonly message: string;
		readonly severity: string;
		readonly type: string;
	};
	readonly handler: unknown;
	readonly timestamp: number;
};

/**
 * DebugResult contract.
 */
export type DebugResult<TOutput = unknown> = {
	readonly result: TOutput;
	readonly trace: readonly EvaluationTrace[];
	readonly caughtErrors?: readonly CaughtErrorTrace[];
};

/**
 * Runtime execution options normalized into {@link EvaluationContext}.
 *
 * @remarks
 * `collectErrors` enables non-fatal catch trace collection, while
 * `strictErrors` keeps operator-level errors fatal unless explicitly handled.
 */
export type EvaluationOptions = {
	readonly operatorRegistry?: OperatorRegistry;
	readonly lazy?: boolean;
	readonly debug?: boolean;
	readonly maxDepth?: number;
	readonly validateArgs?: boolean;
	readonly validateOutput?: boolean;
	readonly scopes?: readonly Scope[];
	readonly strictErrors?: boolean;
	readonly collectErrors?: boolean;
	readonly maxErrorDepth?: number;
	readonly truthinessMode?: TruthinessMode;
};

/**
 * Compiled callable rule with attached source-rule metadata.
 */
export type CompiledRule<TData = unknown, TOutput = unknown> = {
	(data: TData): TOutput;
	readonly rule: Rule;
	readonly compiled: boolean;
};

/**
 * CompiledFunction contract.
 */
export type CompiledFunction<TData = unknown, TOutput = unknown> = (
	data: TData,
) => TOutput;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
/**
 * RuleBuilder contract.
 */
export type RuleBuilder<_TInput = unknown, _TOutput = unknown> = {
	build(): Rule;
	toJSON(): Rule;
	toString(): string;
};

/**
 * OperatorBuilder contract.
 */
export type OperatorBuilder = <TInput = unknown, TOutput = unknown>(
	name: string,
	...args: readonly unknown[]
) => RuleBuilder<TInput, TOutput>;

/**
 * InferInput contract.
 */
export type InferInput<T> = T extends RuleBuilder<infer I> ? I : unknown;
/**
 * InferOutput contract.
 */
export type InferOutput<T> =
	T extends RuleBuilder<unknown, infer O> ? O : unknown;
