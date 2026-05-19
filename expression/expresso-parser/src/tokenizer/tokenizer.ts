import { ParseError, unexpectedChar } from "../errors/parse-error";
import { type Token, TokenKind, token } from "./token";
import {
	advance,
	createScannerContext,
	isAlpha,
	isAtEnd,
	isDigit,
	readIdentifier,
	readNumber,
	readString,
	scanOperator,
	skipWhitespace,
} from "./tokenizer-scan";

export { tokenize };

function tokenize(source: string): Token[] | ParseError {
	const ctx = createScannerContext(source);

	while (!isAtEnd(ctx)) {
		skipWhitespace(ctx);
		if (isAtEnd(ctx)) break;

		const start = ctx.pos;
		const ch = advance(ctx);

		const opResult = scanOperator(ctx, ch, start);
		if (opResult instanceof ParseError) {
			return opResult;
		}
		if (opResult !== null) {
			ctx.tokens.push(opResult);
			continue;
		}

		if (ch === '"' || ch === "'") {
			const str = readString(ctx, ch);
			if (str instanceof ParseError) return str;
			ctx.tokens.push(str);
			continue;
		}

		if (isDigit(ch)) {
			const num = readNumber(ctx);
			ctx.tokens.push(token(TokenKind.Number, num.value, start, num.end));
			continue;
		}

		if (isAlpha(ch)) {
			ctx.tokens.push(readIdentifier(ctx));
			continue;
		}

		return unexpectedChar(start, source, ch);
	}

	ctx.tokens.push(token(TokenKind.EOF, "", ctx.pos, ctx.pos));
	return ctx.tokens;
}
