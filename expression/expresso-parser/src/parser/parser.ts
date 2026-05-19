import {
	expectedIdentifier,
	ParseError,
	tooFewArgs,
	tooManyArgs,
	unexpectedToken,
} from "../errors/parse-error";
import type { OperatorRegistry } from "../operators/registry";
import type { Token } from "../tokenizer/token";
import { TokenKind } from "../tokenizer/token";
import type { ASTLambda, ASTNode } from "./ast";
import { getInfixPrecedence } from "./precedence";

// ---------------------------------------------------------------------------
// Context — plain data + helper functions (no class)
// ---------------------------------------------------------------------------

/**
 * ParserContext contract.
 */
export type ParserContext = {
	readonly tokens: readonly Token[];
	readonly eofToken: Token;
	readonly registry: OperatorRegistry;
	readonly source: string;
	pos: number;
};

/**
 * Executes `makeContext` with the provided inputs.
 *
 * @param tokens - The `tokens` argument value.
 * @param registry - The `registry` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `makeContext`.
 *
 * @example
 * makeContext(tokens, registry, source);
 */

export function makeContext(
	tokens: readonly Token[],
	registry: OperatorRegistry,
	source: string,
): ParserContext {
	const eofToken = tokens[tokens.length - 1];
	if (eofToken === undefined) {
		throw new Error("Token stream must not be empty (missing EOF sentinel).");
	}
	return { tokens, eofToken, registry, source, pos: 0 };
}

function current(ctx: ParserContext): Token {
	return ctx.tokens[ctx.pos] ?? ctx.eofToken;
}

function advance(ctx: ParserContext): Token {
	const t = current(ctx);
	if (ctx.pos < ctx.tokens.length - 1) ctx.pos++;
	return t;
}

function check(ctx: ParserContext, kind: TokenKind): boolean {
	return current(ctx).kind === kind;
}

function match(ctx: ParserContext, kind: TokenKind): boolean {
	if (check(ctx, kind)) {
		advance(ctx);
		return true;
	}
	return false;
}

function expect(
	ctx: ParserContext,
	kind: TokenKind,
	hint?: string,
): Token | ParseError {
	if (check(ctx, kind)) return advance(ctx);
	const t = current(ctx);
	return unexpectedToken(
		String(t.value),
		t.start,
		t.end - t.start,
		ctx.source,
		hint ?? TokenKind[kind],
	);
}

function isAtEnd(ctx: ParserContext): boolean {
	return current(ctx).kind === TokenKind.EOF;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parses expression.
 *
 * @param ctx - The `ctx` argument value.
 * @param minPrec - The `minPrec` argument value.
 *
 * @returns The result produced by `parseExpression`.
 *
 * @example
 * parseExpression(ctx, minPrec);
 */

export function parseExpression(
	ctx: ParserContext,
	minPrec = 0,
): ASTNode | ParseError {
	let left = parsePrimary(ctx);
	if (left instanceof ParseError) return left;

	while (!isAtEnd(ctx)) {
		const op = getInfixOperator(ctx);
		if (!op) break;

		const prec =
			ctx.registry.getInfix(op)?.precedence ?? getInfixPrecedence(op);
		if (prec < minPrec) break;

		advance(ctx);
		const right = parseExpression(ctx, prec + 1);
		if (right instanceof ParseError) return right;

		left = { kind: "binary", operator: op, left, right };
	}

	return left;
}

// ---------------------------------------------------------------------------
// Infix operator detection
// ---------------------------------------------------------------------------

const TOKEN_TO_INFIX: Partial<Record<TokenKind, string>> = {
	[TokenKind.OrOr]: "||",
	[TokenKind.AndAnd]: "&&",
	[TokenKind.EqEq]: "==",
	[TokenKind.EqEqEq]: "===",
	[TokenKind.BangEq]: "!=",
	[TokenKind.BangEqEq]: "!==",
	[TokenKind.Gt]: ">",
	[TokenKind.GtEq]: ">=",
	[TokenKind.Lt]: "<",
	[TokenKind.LtEq]: "<=",
	[TokenKind.Plus]: "+",
	[TokenKind.Minus]: "-",
	[TokenKind.Star]: "*",
	[TokenKind.Slash]: "/",
	[TokenKind.Percent]: "%",
};

function getInfixOperator(ctx: ParserContext): string | null {
	const t = current(ctx);
	const mapped = TOKEN_TO_INFIX[t.kind];
	if (mapped) return mapped;
	if (
		t.kind === TokenKind.Identifier &&
		ctx.registry.getInfix(t.value as string)
	) {
		return t.value as string;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Primary parsing
// ---------------------------------------------------------------------------

function parsePrimary(ctx: ParserContext): ASTNode | ParseError {
	const t = current(ctx);

	switch (t.kind) {
		case TokenKind.Number:
		case TokenKind.String:
		case TokenKind.Bool:
		case TokenKind.Null:
			advance(ctx);
			return { kind: "literal", value: t.value };

		case TokenKind.Identifier: {
			const name = t.value as string;
			advance(ctx);

			if (check(ctx, TokenKind.LParen)) return parseCall(ctx, name);

			const prefixDef = ctx.registry.getPrefix(name);
			if (prefixDef && !check(ctx, TokenKind.LParen)) {
				const operand = parseExpression(ctx, 7);
				if (operand instanceof ParseError) return operand;
				return { kind: "unary", operator: name, operand };
			}

			return { kind: "identifier", path: name };
		}

		case TokenKind.VarKeyword:
			return parseVarCall(ctx);
		case TokenKind.DataMarker:
			return parseDataLiteral(ctx);

		case TokenKind.Bang: {
			advance(ctx);
			const operand = parseExpression(ctx, 7);
			if (operand instanceof ParseError) return operand;
			return { kind: "unary", operator: "!", operand };
		}

		case TokenKind.BangBang: {
			advance(ctx);
			const operand = parseExpression(ctx, 7);
			if (operand instanceof ParseError) return operand;
			return { kind: "unary", operator: "!!", operand };
		}

		case TokenKind.LParen: {
			advance(ctx);
			const expr = parseExpression(ctx);
			if (expr instanceof ParseError) return expr;
			const rparen = expect(ctx, TokenKind.RParen);
			if (rparen instanceof ParseError) return rparen;
			if (check(ctx, TokenKind.Arrow)) return parseLambdaWithParams(ctx, expr);
			return expr;
		}

		case TokenKind.LBrack:
			return parseArrayLiteral(ctx);
		case TokenKind.HashBrace:
			return parseObjectLiteral(ctx);

		default:
			return unexpectedToken(
				String(t.value),
				t.start,
				t.end - t.start,
				ctx.source,
			);
	}
}

// ---------------------------------------------------------------------------
// Literals & calls
// ---------------------------------------------------------------------------

function parseVarCall(ctx: ParserContext): ASTNode | ParseError {
	advance(ctx);
	const lparen = expect(ctx, TokenKind.LParen);
	if (lparen instanceof ParseError) return lparen;
	if (!check(ctx, TokenKind.String)) {
		return expectedIdentifier(current(ctx).start, ctx.source);
	}
	const path = advance(ctx).value as string;
	const rparen = expect(ctx, TokenKind.RParen);
	if (rparen instanceof ParseError) return rparen;
	return { kind: "var-call", path };
}

function parseDataLiteral(ctx: ParserContext): ASTNode | ParseError {
	advance(ctx);
	const lparen = expect(ctx, TokenKind.LParen);
	if (lparen instanceof ParseError) return lparen;
	const value = parseExpression(ctx);
	if (value instanceof ParseError) return value;
	const rparen = expect(ctx, TokenKind.RParen);
	if (rparen instanceof ParseError) return rparen;
	return { kind: "data", value };
}

function parseCall(ctx: ParserContext, name: string): ASTNode | ParseError {
	const startToken = current(ctx);
	advance(ctx); // consume LParen

	const def = ctx.registry.getFunction(name);
	const lambdaPositions = def?.lambdaArgPositions ?? [];
	const args: (ASTNode | ASTLambda)[] = [];

	if (!check(ctx, TokenKind.RParen)) {
		let argIndex = 0;
		do {
			const arg = lambdaPositions.includes(argIndex)
				? parseLambdaArg(ctx)
				: parseExpression(ctx);
			if (arg instanceof ParseError) return arg;
			args.push(arg);
			argIndex++;
		} while (match(ctx, TokenKind.Comma));
	}

	const rparen = expect(ctx, TokenKind.RParen);
	if (rparen instanceof ParseError) return rparen;

	if (def) {
		const span = rparen.end - startToken.start;
		if (args.length < def.minArgs) {
			return tooFewArgs(
				name,
				def.minArgs,
				args.length,
				startToken.start,
				span,
				ctx.source,
			);
		}
		if (def.maxArgs !== null && args.length > def.maxArgs) {
			return tooManyArgs(
				name,
				def.maxArgs,
				args.length,
				startToken.start,
				span,
				ctx.source,
			);
		}
	}

	return { kind: "call", callee: name, args };
}

// ---------------------------------------------------------------------------
// Lambda helpers
// ---------------------------------------------------------------------------

function parseLambdaWithParams(
	ctx: ParserContext,
	params: ASTNode,
): ASTLambda | ParseError {
	if (params.kind === "identifier") {
		advance(ctx); // consume =>
		const body = parseExpression(ctx);
		if (body instanceof ParseError) return body;
		return { kind: "lambda", paramName: params.path, body };
	}

	if (params.kind === "binary" && params.operator === ",") {
		// Flatten left-associative comma tree → [p0, p1, ...]
		const paramList: ASTNode[] = [];
		let node: ASTNode = params;
		while (node.kind === "binary" && node.operator === ",") {
			paramList.unshift(node.right);
			node = node.left;
		}
		paramList.unshift(node);

		if (
			paramList.length !== 2 ||
			paramList[0]?.kind !== "identifier" ||
			paramList[1]?.kind !== "identifier"
		) {
			return unexpectedToken(
				"(",
				current(ctx).start,
				1,
				ctx.source,
				"identifier",
			);
		}

		advance(ctx); // consume =>
		const body = parseExpression(ctx);
		if (body instanceof ParseError) return body;
		return {
			kind: "lambda",
			paramName: paramList[0].path,
			secondParamName: paramList[1].path,
			body,
		};
	}

	return unexpectedToken("(", current(ctx).start, 1, ctx.source, "identifier");
}

function parseLambdaArg(ctx: ParserContext): ASTLambda | ParseError {
	if (check(ctx, TokenKind.LParen)) {
		advance(ctx);

		if (!check(ctx, TokenKind.Identifier)) {
			const t = current(ctx);
			return unexpectedToken(
				String(t.value),
				t.start,
				1,
				ctx.source,
				"identifier",
			);
		}
		const p1 = advance(ctx).value as string;

		let p2: string | undefined;
		if (match(ctx, TokenKind.Comma)) {
			if (!check(ctx, TokenKind.Identifier)) {
				const t = current(ctx);
				return unexpectedToken(
					String(t.value),
					t.start,
					1,
					ctx.source,
					"identifier",
				);
			}
			p2 = advance(ctx).value as string;
		}

		const rparen = expect(ctx, TokenKind.RParen);
		if (rparen instanceof ParseError) return rparen;

		if (!check(ctx, TokenKind.Arrow)) {
			const t = current(ctx);
			return unexpectedToken(String(t.value), t.start, 1, ctx.source, "=>");
		}
		advance(ctx);

		const body = parseExpression(ctx);
		if (body instanceof ParseError) return body;
		return {
			kind: "lambda",
			paramName: p1,
			...(p2 ? { secondParamName: p2 } : {}),
			body,
		};
	}

	if (check(ctx, TokenKind.Identifier)) {
		const p1 = advance(ctx).value as string;

		if (!check(ctx, TokenKind.Arrow)) {
			if (ctx.registry.getPrefix(p1)) {
				const operand = parseExpression(ctx, 7);
				if (operand instanceof ParseError) return operand;
				return {
					kind: "lambda",
					paramName: p1,
					body: { kind: "unary", operator: p1, operand },
				};
			}
			return {
				kind: "lambda",
				paramName: p1,
				body: { kind: "identifier", path: p1 },
			};
		}
		advance(ctx);

		const body = parseExpression(ctx);
		if (body instanceof ParseError) return body;
		return { kind: "lambda", paramName: p1, body };
	}

	const t = current(ctx);
	return unexpectedToken(String(t.value), t.start, 1, ctx.source, "identifier");
}

// ---------------------------------------------------------------------------
// Collection literals
// ---------------------------------------------------------------------------

function parseArrayLiteral(ctx: ParserContext): ASTNode | ParseError {
	advance(ctx);
	const elements: ASTNode[] = [];

	if (!check(ctx, TokenKind.RBrack)) {
		do {
			const elem = parseExpression(ctx);
			if (elem instanceof ParseError) return elem;
			elements.push(elem);
		} while (match(ctx, TokenKind.Comma));
	}

	const rbrack = expect(ctx, TokenKind.RBrack);
	if (rbrack instanceof ParseError) return rbrack;
	return { kind: "array", elements };
}

function parseObjectLiteral(ctx: ParserContext): ASTNode | ParseError {
	advance(ctx);
	const entries: Array<{ key: string; value: ASTNode }> = [];

	if (!check(ctx, TokenKind.RBrace)) {
		do {
			const keyToken = current(ctx);
			let key: string;

			if (check(ctx, TokenKind.String) || check(ctx, TokenKind.Identifier)) {
				key = advance(ctx).value as string;
			} else {
				return unexpectedToken(
					String(keyToken.value),
					keyToken.start,
					keyToken.end - keyToken.start,
					ctx.source,
					"string or identifier",
				);
			}

			const colon = expect(ctx, TokenKind.Colon);
			if (colon instanceof ParseError) return colon;

			const value = parseExpression(ctx);
			if (value instanceof ParseError) return value;

			entries.push({ key, value });
		} while (match(ctx, TokenKind.Comma));
	}

	const rbrace = expect(ctx, TokenKind.RBrace);
	if (rbrace instanceof ParseError) return rbrace;
	return { kind: "object", entries };
}
