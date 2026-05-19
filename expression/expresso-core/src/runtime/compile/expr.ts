import type { EvaluationOptions, Rule } from "../contracts/types";
import { apply } from "./apply";
import type {
	ExprDiagnosticsOptions,
	RawExprUsageDiagnostic,
} from "./expr-diagnostics";
import { reportRawUsage } from "./expr-diagnostics";
import type {
	ArgsOf,
	OperatorId,
	OperatorTypeRegistryLike,
	OutputOf,
} from "./operator-types";
import type { Path, PathValue } from "./path-types";

/**
 * Expr contract.
 */
export interface Expr<TData = unknown, TOut = unknown> {
	/** __data value. */
	readonly __data?: TData;
	/** __out value. */
	readonly __out?: TOut;
	toRule(): Rule;
	toJSON(): Rule;
	toString(): string;
	diagnostics(): readonly RawExprUsageDiagnostic[];
	apply(data: TData, options?: EvaluationOptions): TOut;
}

/**
 * ExprBuilder contract.
 */
export interface ExprBuilder<TData = unknown> {
	fromRule<TOut = unknown>(rule: Rule): Expr<TData, TOut>;
	var<TPath extends Path<TData>>(
		path: TPath,
	): Expr<TData, PathValue<TData, TPath>>;
	varRaw(path: string): Expr<TData, unknown>;
	opRaw<TOut = unknown>(
		name: string,
		...args: readonly ExprOperatorArg<TData, unknown>[]
	): Expr<TData, TOut>;
	withOperators<TRegistry extends OperatorTypeRegistryLike>(
		registry: TRegistry,
	): TypedExprBuilder<TData, TRegistry>;
}

class ExprImpl<TData = unknown, TOut = unknown> implements Expr<TData, TOut> {
	private readonly rule: Rule;
	private readonly rawDiagnostics: readonly RawExprUsageDiagnostic[];

	constructor(
		rule: Rule,
		rawDiagnostics: readonly RawExprUsageDiagnostic[] = [],
	) {
		this.rule = rule;
		this.rawDiagnostics = rawDiagnostics;
	}

	toRule(): Rule {
		return this.rule;
	}

	toJSON(): Rule {
		return this.rule;
	}

	toString(): string {
		return JSON.stringify(this.rule);
	}

	diagnostics(): readonly RawExprUsageDiagnostic[] {
		return this.rawDiagnostics;
	}

	apply(data: TData, options?: EvaluationOptions): TOut {
		return apply(this.rule, data, options);
	}
}

type ExprOperatorArg<TData, TValue> = TValue | Expr<TData, TValue>;

type ExprOperatorArgsTuple<TData, TArgs extends readonly unknown[]> = {
	readonly [K in keyof TArgs]: ExprOperatorArg<TData, TArgs[K]>;
};

/**
 * TypedExprBuilder contract.
 */
export interface TypedExprBuilder<
	TData,
	TRegistry extends OperatorTypeRegistryLike,
> extends ExprBuilder<TData> {
	op<TId extends OperatorId<TRegistry>>(
		name: TId,
		...args: ExprOperatorArgsTuple<TData, ArgsOf<TRegistry, TId>>
	): Expr<TData, OutputOf<TRegistry, TId>>;
}

function isExpr(value: unknown): value is Expr<unknown, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		"toRule" in value &&
		typeof (value as { toRule?: unknown }).toRule === "function"
	);
}

function toRuleArgument(value: unknown): unknown {
	return isExpr(value) ? value.toRule() : value;
}

function createOperatorRule(name: string, args: readonly unknown[]): Rule {
	if (args.length === 0) {
		return { [name]: true } as Rule;
	}

	if (args.length === 1) {
		return { [name]: args[0] } as Rule;
	}

	return { [name]: args } as Rule;
}

class ExprBuilderImpl<TData = unknown> implements ExprBuilder<TData> {
	private readonly options: ExprDiagnosticsOptions;

	constructor(options: ExprDiagnosticsOptions = {}) {
		this.options = options;
	}

	fromRule<TOut = unknown>(rule: Rule): Expr<TData, TOut> {
		return new ExprImpl<TData, TOut>(rule);
	}

	var<TPath extends Path<TData>>(
		path: TPath,
	): Expr<TData, PathValue<TData, TPath>> {
		return this.fromRule<PathValue<TData, TPath>>({ var: path });
	}

	varRaw(path: string): Expr<TData, unknown> {
		const diagnostic: RawExprUsageDiagnostic = {
			kind: "varRaw",
			value: path,
		};
		reportRawUsage(this.options, diagnostic);
		return new ExprImpl<TData, unknown>({ var: path }, [diagnostic]);
	}

	private operatorExpr<TOut = unknown>(
		name: string,
		isRaw: boolean,
		...args: readonly ExprOperatorArg<TData, unknown>[]
	): Expr<TData, TOut> {
		const normalized = args.map(toRuleArgument);
		const diagnostics = args.flatMap((arg) =>
			isExpr(arg) ? arg.diagnostics() : [],
		);

		if (isRaw) {
			const diagnostic: RawExprUsageDiagnostic = { kind: "opRaw", value: name };
			reportRawUsage(this.options, diagnostic);
			return new ExprImpl<TData, TOut>(createOperatorRule(name, normalized), [
				...diagnostics,
				diagnostic,
			]);
		}

		return new ExprImpl<TData, TOut>(
			createOperatorRule(name, normalized),
			diagnostics,
		);
	}

	opRaw<TOut = unknown>(
		name: string,
		...args: readonly ExprOperatorArg<TData, unknown>[]
	): Expr<TData, TOut> {
		return this.operatorExpr<TOut>(name, true, ...args);
	}

	withOperators<TRegistry extends OperatorTypeRegistryLike>(
		_registry: TRegistry,
	): TypedExprBuilder<TData, TRegistry> {
		const base = this;

		return {
			fromRule<TOut = unknown>(rule: Rule): Expr<TData, TOut> {
				return base.fromRule(rule);
			},
			var<TPath extends Path<TData>>(
				path: TPath,
			): Expr<TData, PathValue<TData, TPath>> {
				return base.var(path);
			},
			varRaw(path: string): Expr<TData, unknown> {
				return base.varRaw(path);
			},
			opRaw<TOut = unknown>(
				name: string,
				...args: readonly ExprOperatorArg<TData, unknown>[]
			): Expr<TData, TOut> {
				return base.opRaw(name, ...args);
			},
			withOperators<TNextRegistry extends OperatorTypeRegistryLike>(
				registry: TNextRegistry,
			): TypedExprBuilder<TData, TNextRegistry> {
				return base.withOperators(registry);
			},
			op<TId extends OperatorId<TRegistry>>(
				name: TId,
				...args: ExprOperatorArgsTuple<TData, ArgsOf<TRegistry, TId>>
			): Expr<TData, OutputOf<TRegistry, TId>> {
				return base.operatorExpr<OutputOf<TRegistry, TId>>(
					name,
					false,
					...(args as readonly ExprOperatorArg<TData, unknown>[]),
				);
			},
		};
	}
}

/**
 * Executes `expr` with the provided inputs.
 *
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `expr`.
 *
 * @example
 * expr(options);
 */

export function expr<TData = unknown>(
	options: ExprDiagnosticsOptions = {},
): ExprBuilder<TData> {
	return new ExprBuilderImpl<TData>(options);
}
