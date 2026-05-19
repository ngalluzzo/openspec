import { emit } from "../emitter/emitter";
import { createEmitContext } from "../emitter/lambda-context";
import { outerVarInReduce, ParseError } from "../errors/parse-error";
import { createDefaultRegistry, type OperatorRegistry } from "../operators";
import { makeContext, parseExpression } from "../parser/parser";
import { TokenKind } from "../tokenizer/token";
import { tokenize } from "../tokenizer/tokenizer";
import type { ParseResult } from "../types/parse-result";

/**
 * ParseOptions contract.
 */
export type ParseOptions = {
	registry?: OperatorRegistry;
};

/**
 * Parses expression to rule.
 *
 * @param source - The `source` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `parseExpressionToRule`.
 *
 * @example
 * parseExpressionToRule(source, options);
 */

export function parseExpressionToRule(
	source: string,
	options?: ParseOptions,
): ParseResult {
	const registry = options?.registry ?? createDefaultRegistry();

	const tokens = tokenize(source);
	if (tokens instanceof ParseError) {
		return { ok: false, error: tokens };
	}

	const ctx = makeContext(tokens, registry, source);
	const ast = parseExpression(ctx);

	if (ast instanceof ParseError) {
		return { ok: false, error: ast };
	}

	const currentToken = ctx.tokens[ctx.pos] ?? ctx.eofToken;
	if (currentToken.kind !== TokenKind.EOF) {
		const t = currentToken;
		return {
			ok: false,
			error: new ParseError(
				"UNEXPECTED_TOKEN",
				`Unexpected token '${t.value}' after expression`,
				t.start,
				t.end - t.start,
				source,
			),
		};
	}

	try {
		const emitCtx = createEmitContext();
		const rule = emit(ast, emitCtx, source);
		const envelope = { $expr: rule };
		return { ok: true, rule, envelope };
	} catch (e) {
		if (e instanceof Error && e.message.startsWith("OUTER_VAR_IN_REDUCE:")) {
			const parts = e.message.split(":");
			const offset = Number(parts[1]);
			const length = Number(parts[2]);
			const path = parts[3] ?? "";
			return {
				ok: false,
				error: outerVarInReduce(path, offset, length, source),
			};
		}
		if (e instanceof ParseError) {
			return { ok: false, error: e };
		}
		throw e;
	}
}

/**
 * Parses expression or throw.
 *
 * @param source - The `source` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `parseExpressionOrThrow`.
 *
 * @example
 * parseExpressionOrThrow(source, options);
 */

export function parseExpressionOrThrow(source: string, options?: ParseOptions) {
	const result = parseExpressionToRule(source, options);
	if (result.ok) {
		return result.rule;
	}
	throw result.error;
}
