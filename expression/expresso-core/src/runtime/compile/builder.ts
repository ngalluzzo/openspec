import type { z } from "zod";
import type { EvaluationOptions, Rule, RuleBuilder } from "../contracts/types";
import { apply } from "./apply";

class RuleBuilderImpl<TInput = unknown, TOutput = unknown>
	implements RuleBuilder<TInput, TOutput>
{
	private readonly _rule: Rule;

	constructor(rule?: Rule) {
		this._rule = rule ?? true;
	}

	private operator(name: string, ...args: readonly unknown[]): RuleBuilderImpl {
		let nextRule: Rule;
		if (args.length === 0) {
			nextRule = { [name]: true } as Rule;
		} else if (args.length === 1) {
			nextRule = { [name]: args[0] } as Rule;
		} else {
			nextRule = { [name]: args } as Rule;
		}
		return new RuleBuilderImpl(nextRule);
	}

	var(path: string): RuleBuilderImpl {
		return this.operator("var", path);
	}

	missing(...fields: readonly string[]): RuleBuilderImpl {
		return this.operator("missing", fields);
	}

	missing_some(count: number, fields: readonly string[]): RuleBuilderImpl {
		return this.operator("missing_some", [count, fields]);
	}

	if(
		condition: RuleBuilder | Rule,
		then: RuleBuilder | Rule,
		els?: RuleBuilder | Rule,
	): RuleBuilderImpl {
		const condRule =
			condition instanceof RuleBuilderImpl ? condition.build() : condition;
		const thenRule = then instanceof RuleBuilderImpl ? then.build() : then;
		const elseRule =
			els !== undefined
				? els instanceof RuleBuilderImpl
					? els.build()
					: els
				: null;
		return this.operator("if", [condRule, thenRule, elseRule]);
	}

	eq(other: RuleBuilder | Rule | unknown): RuleBuilderImpl {
		const value = other instanceof RuleBuilderImpl ? other.build() : other;
		return this.operator("==", [this._rule, value]);
	}

	strictEq(other: RuleBuilder | Rule | unknown): RuleBuilderImpl {
		const value = other instanceof RuleBuilderImpl ? other.build() : other;
		return this.operator("===", [this._rule, value]);
	}

	neq(other: RuleBuilder | Rule | unknown): RuleBuilderImpl {
		const value = other instanceof RuleBuilderImpl ? other.build() : other;
		return this.operator("!=", [this._rule, value]);
	}

	strictNeq(other: RuleBuilder | Rule | unknown): RuleBuilderImpl {
		const value = other instanceof RuleBuilderImpl ? other.build() : other;
		return this.operator("!==", [this._rule, value]);
	}

	not(): RuleBuilderImpl {
		return this.operator("!", this._rule);
	}

	isTrue(): RuleBuilderImpl {
		return this.operator("!!", this._rule);
	}

	and(...rules: readonly (RuleBuilder | Rule)[]): RuleBuilderImpl {
		const builtRules: readonly unknown[] = rules.map((r) =>
			r instanceof RuleBuilderImpl ? r.build() : r,
		);
		return this.operator("and", [this._rule, ...builtRules]);
	}

	or(...rules: readonly (RuleBuilder | Rule)[]): RuleBuilderImpl {
		const builtRules: readonly unknown[] = rules.map((r) =>
			r instanceof RuleBuilderImpl ? r.build() : r,
		);
		return this.operator("or", [this._rule, ...builtRules]);
	}

	gt(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator(">", [this._rule, val]);
	}

	gte(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator(">=", [this._rule, val]);
	}

	lt(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("<", [this._rule, val]);
	}

	lte(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("<=", [this._rule, val]);
	}

	between(min: number, max: number): RuleBuilderImpl {
		return this.operator("<=", [min, this._rule, max]);
	}

	min(...values: readonly number[]): RuleBuilderImpl {
		return this.operator("min", [...values, this._rule]);
	}

	max(...values: readonly number[]): RuleBuilderImpl {
		return this.operator("max", [...values, this._rule]);
	}

	add(...values: readonly (RuleBuilder | Rule | number)[]): RuleBuilderImpl {
		const vals: readonly unknown[] = values.map((v) =>
			v instanceof RuleBuilderImpl ? v.build() : v,
		);
		return this.operator("+", [this._rule, ...vals]);
	}

	subtract(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("-", [this._rule, val]);
	}

	multiply(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("*", [this._rule, val]);
	}

	divide(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("/", [this._rule, val]);
	}

	modulo(value: RuleBuilder | Rule | number): RuleBuilderImpl {
		const val = value instanceof RuleBuilderImpl ? value.build() : value;
		return this.operator("%", [this._rule, val]);
	}

	in(value: unknown): RuleBuilderImpl {
		return this.operator("in", [this._rule, value]);
	}

	map(mappingRule: RuleBuilder | Rule): RuleBuilderImpl {
		const rule =
			mappingRule instanceof RuleBuilderImpl
				? mappingRule.build()
				: mappingRule;
		return this.operator("map", [this._rule, rule]);
	}

	filter(predicateRule: RuleBuilder | Rule): RuleBuilderImpl {
		const rule =
			predicateRule instanceof RuleBuilderImpl
				? predicateRule.build()
				: predicateRule;
		return this.operator("filter", [this._rule, rule]);
	}

	reduce(reducerRule: RuleBuilder | Rule, initial?: unknown): RuleBuilderImpl {
		const rule =
			reducerRule instanceof RuleBuilderImpl
				? reducerRule.build()
				: reducerRule;
		return this.operator("reduce", [this._rule, rule, initial]);
	}

	all(): RuleBuilderImpl {
		return this.operator("all", this._rule);
	}

	none(): RuleBuilderImpl {
		return this.operator("none", this._rule);
	}

	some(): RuleBuilderImpl {
		return this.operator("some", this._rule);
	}

	merge(...values: readonly unknown[]): RuleBuilderImpl {
		return this.operator("merge", [this._rule, ...values]);
	}

	cat(...values: readonly (RuleBuilder | Rule | string)[]): RuleBuilderImpl {
		const vals: readonly unknown[] = values.map((v) =>
			v instanceof RuleBuilderImpl ? v.build() : v,
		);
		return this.operator("cat", [this._rule, ...vals]);
	}

	substr(start: number, length?: number): RuleBuilderImpl {
		if (length !== undefined) {
			return this.operator("substr", [this._rule, start, length]);
		}
		return this.operator("substr", [this._rule, start]);
	}

	compose(other: RuleBuilder | Rule): RuleBuilderImpl {
		const otherRule = other instanceof RuleBuilderImpl ? other.build() : other;
		return new RuleBuilderImpl(otherRule as Rule);
	}

	schema<TSchema extends z.ZodType>(
		_schema: TSchema,
	): RuleBuilderImpl<z.infer<TSchema>, TOutput> {
		return this as RuleBuilderImpl<z.infer<TSchema>, TOutput>;
	}

	apply(data: TInput, options?: EvaluationOptions): TOutput {
		return apply(this._rule, data, options);
	}

	build(): Rule {
		return this._rule;
	}

	toJSON(): Rule {
		return this._rule;
	}

	toString(): string {
		return JSON.stringify(this._rule);
	}
}

/**
 * Executes `rule` with the provided inputs.
 *
 * @returns The result produced by `rule`.
 *
 * @example
 * rule();
 */

export function rule<TInput = unknown, TOutput = unknown>(): RuleBuilderImpl<
	TInput,
	TOutput
> {
	return new RuleBuilderImpl();
}

/**
 * Executes `raw` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 *
 * @returns The result produced by `raw`.
 *
 * @example
 * raw(rule);
 */

export function raw(rule: Rule): RuleBuilderImpl {
	return new RuleBuilderImpl(rule);
}
