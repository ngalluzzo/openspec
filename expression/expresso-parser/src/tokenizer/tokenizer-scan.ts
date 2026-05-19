import {
	invalidEscape,
	type ParseError,
	unexpectedChar,
	unterminatedString,
} from "../errors/parse-error";
import { type Token, TokenKind, token } from "./token";

export const KEYWORDS = new Map<string, TokenKind>([
	["true", TokenKind.Bool],
	["false", TokenKind.Bool],
	["null", TokenKind.Null],
	["var", TokenKind.VarKeyword],
]);

/**
 * ScannerContext contract.
 */
export type ScannerContext = {
	source: string;
	pos: number;
	tokens: Token[];
};

/**
 * Creates scanner context.
 *
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `createScannerContext`.
 *
 * @example
 * createScannerContext(source);
 */

export function createScannerContext(source: string): ScannerContext {
	return { source, pos: 0, tokens: [] };
}

/**
 * Executes `peek` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 * @param offset - The `offset` argument value.
 *
 * @returns The result produced by `peek`.
 *
 * @example
 * peek(ctx, offset);
 */

export function peek(ctx: ScannerContext, offset = 0): string {
	return ctx.source[ctx.pos + offset] ?? "";
}

/**
 * Executes `advance` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `advance`.
 *
 * @example
 * advance(ctx);
 */

export function advance(ctx: ScannerContext): string {
	return ctx.source[ctx.pos++] ?? "";
}

/**
 * Executes `isAtEnd` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `isAtEnd`.
 *
 * @example
 * isAtEnd(ctx);
 */

export function isAtEnd(ctx: ScannerContext): boolean {
	return ctx.pos >= ctx.source.length;
}

/**
 * Executes `isWhitespace` with the provided inputs.
 *
 * @param ch - The `ch` argument value.
 *
 * @returns The result produced by `isWhitespace`.
 *
 * @example
 * isWhitespace(ch);
 */

export function isWhitespace(ch: string): boolean {
	return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

/**
 * Executes `isDigit` with the provided inputs.
 *
 * @param ch - The `ch` argument value.
 *
 * @returns The result produced by `isDigit`.
 *
 * @example
 * isDigit(ch);
 */

export function isDigit(ch: string): boolean {
	return ch >= "0" && ch <= "9";
}

/**
 * Executes `isAlpha` with the provided inputs.
 *
 * @param ch - The `ch` argument value.
 *
 * @returns The result produced by `isAlpha`.
 *
 * @example
 * isAlpha(ch);
 */

export function isAlpha(ch: string): boolean {
	return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

/**
 * Executes `isAlphaNumeric` with the provided inputs.
 *
 * @param ch - The `ch` argument value.
 *
 * @returns The result produced by `isAlphaNumeric`.
 *
 * @example
 * isAlphaNumeric(ch);
 */

export function isAlphaNumeric(ch: string): boolean {
	return isAlpha(ch) || isDigit(ch);
}

/**
 * Executes `skipWhitespace` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @example
 * skipWhitespace(ctx);
 */

export function skipWhitespace(ctx: ScannerContext): void {
	while (!isAtEnd(ctx) && isWhitespace(peek(ctx))) {
		advance(ctx);
	}
}

/**
 * Reads string.
 *
 * @param ctx - The `ctx` argument value.
 * @param quote - The `quote` argument value.
 *
 * @returns The result produced by `readString`.
 *
 * @example
 * readString(ctx, quote);
 */

export function readString(
	ctx: ScannerContext,
	quote: string,
): Token | ParseError {
	const start = ctx.pos - 1;
	let value = "";

	while (!isAtEnd(ctx) && peek(ctx) !== quote) {
		if (peek(ctx) === "\n") {
			return unterminatedString(start, ctx.source);
		}
		if (peek(ctx) === "\\") {
			advance(ctx);
			if (isAtEnd(ctx)) {
				return unterminatedString(start, ctx.source);
			}
			const escaped = advance(ctx);
			switch (escaped) {
				case "n":
					value += "\n";
					break;
				case "t":
					value += "\t";
					break;
				case "r":
					value += "\r";
					break;
				case "\\":
					value += "\\";
					break;
				case '"':
					value += '"';
					break;
				case "'":
					value += "'";
					break;
				default:
					return invalidEscape(ctx.pos - 2, ctx.source, escaped);
			}
		} else {
			value += advance(ctx);
		}
	}

	if (isAtEnd(ctx)) {
		return unterminatedString(start, ctx.source);
	}
	advance(ctx);
	return token(TokenKind.String, value, start, ctx.pos);
}

/**
 * Reads number.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `readNumber`.
 *
 * @example
 * readNumber(ctx);
 */

export function readNumber(ctx: ScannerContext): Token {
	const start = ctx.pos - 1;
	while (!isAtEnd(ctx) && isDigit(peek(ctx))) {
		advance(ctx);
	}
	if (!isAtEnd(ctx) && peek(ctx) === "." && isDigit(peek(ctx, 1))) {
		advance(ctx);
		while (!isAtEnd(ctx) && isDigit(peek(ctx))) {
			advance(ctx);
		}
	}
	const value = Number.parseFloat(ctx.source.slice(start, ctx.pos));
	return token(TokenKind.Number, value, start, ctx.pos);
}

/**
 * Reads identifier.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `readIdentifier`.
 *
 * @example
 * readIdentifier(ctx);
 */

export function readIdentifier(ctx: ScannerContext): Token {
	const start = ctx.pos - 1;
	while (!isAtEnd(ctx) && isAlphaNumeric(peek(ctx))) {
		advance(ctx);
	}
	while (!isAtEnd(ctx) && peek(ctx) === "." && isAlpha(peek(ctx, 1))) {
		const nextPos = ctx.pos + 1;
		let segmentEnd = nextPos;
		while (segmentEnd < ctx.source.length) {
			const segmentChar = ctx.source[segmentEnd];
			if (segmentChar === undefined || !isAlphaNumeric(segmentChar)) {
				break;
			}
			segmentEnd++;
		}
		const segment = ctx.source.slice(nextPos, segmentEnd);
		if (KEYWORDS.has(segment)) {
			break;
		}
		advance(ctx);
		while (!isAtEnd(ctx) && isAlphaNumeric(peek(ctx))) {
			advance(ctx);
		}
	}
	const text = ctx.source.slice(start, ctx.pos);
	const kind = KEYWORDS.get(text) ?? TokenKind.Identifier;
	if (kind === TokenKind.Bool) {
		return token(kind, text === "true", start, ctx.pos);
	}
	if (kind === TokenKind.Null) {
		return token(kind, null, start, ctx.pos);
	}
	return token(kind, text, start, ctx.pos);
}

/**
 * Executes `previousTokenKind` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `previousTokenKind`.
 *
 * @example
 * previousTokenKind(ctx);
 */

export function previousTokenKind(ctx: ScannerContext): TokenKind | null {
	for (let i = ctx.tokens.length - 1; i >= 0; i--) {
		const t = ctx.tokens[i];
		if (t) return t.kind;
	}
	return null;
}

const UNARY_CONTEXT_KINDS = new Set([
	TokenKind.LParen,
	TokenKind.LBrack,
	TokenKind.LBrace,
	TokenKind.HashBrace,
	TokenKind.Comma,
	TokenKind.Arrow,
	TokenKind.Plus,
	TokenKind.Minus,
	TokenKind.Star,
	TokenKind.Slash,
	TokenKind.Percent,
	TokenKind.EqEq,
	TokenKind.EqEqEq,
	TokenKind.BangEq,
	TokenKind.BangEqEq,
	TokenKind.Gt,
	TokenKind.GtEq,
	TokenKind.Lt,
	TokenKind.LtEq,
	TokenKind.AndAnd,
	TokenKind.OrOr,
	TokenKind.Bang,
	TokenKind.BangBang,
	TokenKind.Colon,
]);

/**
 * Executes `canBeNegativeNumber` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `canBeNegativeNumber`.
 *
 * @example
 * canBeNegativeNumber(ctx);
 */

export function canBeNegativeNumber(ctx: ScannerContext): boolean {
	if (ctx.tokens.length === 0) return true;
	const prev = previousTokenKind(ctx);
	return prev !== null && UNARY_CONTEXT_KINDS.has(prev);
}

/**
 * Executes `scanOperator` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 * @param ch - The `ch` argument value.
 * @param start - The `start` argument value.
 *
 * @returns The result produced by `scanOperator`.
 *
 * @example
 * scanOperator(ctx, ch, start);
 */

export function scanOperator(
	ctx: ScannerContext,
	ch: string,
	start: number,
): Token | ParseError | null {
	switch (ch) {
		case "+":
			return token(TokenKind.Plus, "+", start, ctx.pos);
		case "*":
			return token(TokenKind.Star, "*", start, ctx.pos);
		case "/":
			return token(TokenKind.Slash, "/", start, ctx.pos);
		case "%":
			return token(TokenKind.Percent, "%", start, ctx.pos);
		case "(":
			return token(TokenKind.LParen, "(", start, ctx.pos);
		case ")":
			return token(TokenKind.RParen, ")", start, ctx.pos);
		case "[":
			return token(TokenKind.LBrack, "[", start, ctx.pos);
		case "]":
			return token(TokenKind.RBrack, "]", start, ctx.pos);
		case "{":
			return token(TokenKind.LBrace, "{", start, ctx.pos);
		case "}":
			return token(TokenKind.RBrace, "}", start, ctx.pos);
		case ",":
			return token(TokenKind.Comma, ",", start, ctx.pos);
		case ":":
			return token(TokenKind.Colon, ":", start, ctx.pos);
		case "#":
			if (peek(ctx) === "{") {
				advance(ctx);
				return token(TokenKind.HashBrace, "#{", start, ctx.pos);
			}
			return unexpectedChar(start, ctx.source, ch);
		case "@":
			if (
				peek(ctx) === "d" &&
				ctx.source.slice(ctx.pos, ctx.pos + 4) === "data"
			) {
				ctx.pos += 4;
				return token(TokenKind.DataMarker, "@data", start, ctx.pos);
			}
			return unexpectedChar(start, ctx.source, ch);
		case "-":
			if (!isAtEnd(ctx) && peek(ctx) === ">" && ctx.tokens.length > 0) {
				const lastToken = ctx.tokens[ctx.tokens.length - 1];
				if (
					lastToken &&
					(lastToken.kind === TokenKind.Identifier ||
						lastToken.kind === TokenKind.RParen)
				) {
					advance(ctx);
					return token(TokenKind.Arrow, "=>", start, ctx.pos);
				}
			}
			if (!isAtEnd(ctx) && isDigit(peek(ctx)) && canBeNegativeNumber(ctx)) {
				advance(ctx);
				const num = readNumber(ctx);
				return token(TokenKind.Number, -(num.value as number), start, num.end);
			}
			return token(TokenKind.Minus, "-", start, ctx.pos);
		case "=":
			if (peek(ctx) === "=") {
				advance(ctx);
				if (peek(ctx) === "=") {
					advance(ctx);
					return token(TokenKind.EqEqEq, "===", start, ctx.pos);
				}
				return token(TokenKind.EqEq, "==", start, ctx.pos);
			}
			if (peek(ctx) === ">") {
				advance(ctx);
				return token(TokenKind.Arrow, "=>", start, ctx.pos);
			}
			return unexpectedChar(start, ctx.source, ch);
		case "!":
			if (peek(ctx) === "=") {
				advance(ctx);
				if (peek(ctx) === "=") {
					advance(ctx);
					return token(TokenKind.BangEqEq, "!==", start, ctx.pos);
				}
				return token(TokenKind.BangEq, "!=", start, ctx.pos);
			}
			if (peek(ctx) === "!") {
				advance(ctx);
				return token(TokenKind.BangBang, "!!", start, ctx.pos);
			}
			return token(TokenKind.Bang, "!", start, ctx.pos);
		case ">":
			if (peek(ctx) === "=") {
				advance(ctx);
				return token(TokenKind.GtEq, ">=", start, ctx.pos);
			}
			return token(TokenKind.Gt, ">", start, ctx.pos);
		case "<":
			if (peek(ctx) === "=") {
				advance(ctx);
				return token(TokenKind.LtEq, "<=", start, ctx.pos);
			}
			return token(TokenKind.Lt, "<", start, ctx.pos);
		case "&":
			if (peek(ctx) === "&") {
				advance(ctx);
				return token(TokenKind.AndAnd, "&&", start, ctx.pos);
			}
			return unexpectedChar(start, ctx.source, ch);
		case "|":
			if (peek(ctx) === "|") {
				advance(ctx);
				return token(TokenKind.OrOr, "||", start, ctx.pos);
			}
			return unexpectedChar(start, ctx.source, ch);
		default:
			return null;
	}
}
