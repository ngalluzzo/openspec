/**
 * ParseErrorCode contract.
 */
export type ParseErrorCode =
	| "UNEXPECTED_TOKEN"
	| "UNEXPECTED_EOF"
	| "UNEXPECTED_CHAR"
	| "UNTERMINATED_STRING"
	| "INVALID_ESCAPE"
	| "TOO_FEW_ARGS"
	| "TOO_MANY_ARGS"
	| "INVALID_LAMBDA_POSITION"
	| "OUTER_VAR_IN_REDUCE"
	| "ARITY_MISMATCH"
	| "UNKNOWN_OPERATOR"
	| "EXPECTED_IDENTIFIER"
	| "EXPECTED_LAMBDA_PARAM"
	| "INVALID_OBJECT_KEY"
	| "EMPTY_OBJECT_KEY";

export class ParseError extends Error {
	readonly code: ParseErrorCode;
	readonly offset: number;
	readonly length: number;
	readonly source: string;
	readonly suggestion: string | undefined;

	constructor(
		code: ParseErrorCode,
		message: string,
		offset: number,
		length: number,
		source: string,
		suggestion?: string,
	) {
		super(message);
		this.name = "ParseError";
		this.code = code;
		this.offset = offset;
		this.length = length;
		this.source = source;
		this.suggestion = suggestion;
	}

	format(): string {
		const lines = this.source.split("\n");
		let lineStart = 0;
		let lineNum = 1;
		let colNum = 1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			const lineEnd = lineStart + line.length;
			if (this.offset >= lineStart && this.offset <= lineEnd) {
				lineNum = i + 1;
				colNum = this.offset - lineStart + 1;
				break;
			}
			lineStart = lineEnd + 1;
		}

		const line = lines[lineNum - 1] ?? "";
		const caretLine =
			" ".repeat(colNum - 1) + "^".repeat(Math.max(1, this.length));
		const location = `line ${lineNum}, col ${colNum}`;

		let result = `ParseError [${this.code}] at ${location}: ${this.message}\n  ${line}\n  ${caretLine}`;
		if (this.suggestion) {
			result += `\n  Suggestion: ${this.suggestion}`;
		}
		return result;
	}
}

/**
 * Executes `unexpectedToken` with the provided inputs.
 *
 * @param token - The `token` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 * @param expected - The `expected` argument value.
 *
 * @returns The result produced by `unexpectedToken`.
 *
 * @example
 * unexpectedToken(token, offset, length, source, expected);
 */

export function unexpectedToken(
	token: string,
	offset: number,
	length: number,
	source: string,
	expected?: string,
): ParseError {
	const msg = expected
		? `Unexpected token '${token}', expected ${expected}`
		: `Unexpected token '${token}'`;
	return new ParseError("UNEXPECTED_TOKEN", msg, offset, length, source);
}

/**
 * Executes `unexpectedEOF` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `unexpectedEOF`.
 *
 * @example
 * unexpectedEOF(offset, source);
 */

export function unexpectedEOF(offset: number, source: string): ParseError {
	return new ParseError(
		"UNEXPECTED_EOF",
		"Unexpected end of input",
		offset,
		0,
		source,
	);
}

/**
 * Executes `unterminatedString` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `unterminatedString`.
 *
 * @example
 * unterminatedString(offset, source);
 */

export function unterminatedString(offset: number, source: string): ParseError {
	return new ParseError(
		"UNTERMINATED_STRING",
		"Unterminated string literal",
		offset,
		1,
		source,
	);
}

/**
 * Executes `invalidEscape` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 * @param char - The `char` argument value.
 *
 * @returns The result produced by `invalidEscape`.
 *
 * @example
 * invalidEscape(offset, source, char);
 */

export function invalidEscape(
	offset: number,
	source: string,
	char: string,
): ParseError {
	return new ParseError(
		"INVALID_ESCAPE",
		`Invalid escape sequence '\\${char}'`,
		offset,
		2,
		source,
	);
}

/**
 * Converts input to o few args.
 *
 * @param op - The `op` argument value.
 * @param expected - The `expected` argument value.
 * @param actual - The `actual` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `tooFewArgs`.
 *
 * @example
 * tooFewArgs(op, expected, actual, offset, length, source);
 */

export function tooFewArgs(
	op: string,
	expected: number,
	actual: number,
	offset: number,
	length: number,
	source: string,
): ParseError {
	return new ParseError(
		"TOO_FEW_ARGS",
		`Operator '${op}' requires at least ${expected} argument(s), got ${actual}`,
		offset,
		length,
		source,
	);
}

/**
 * Converts input to o many args.
 *
 * @param op - The `op` argument value.
 * @param expected - The `expected` argument value.
 * @param actual - The `actual` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `tooManyArgs`.
 *
 * @example
 * tooManyArgs(op, expected, actual, offset, length, source);
 */

export function tooManyArgs(
	op: string,
	expected: number,
	actual: number,
	offset: number,
	length: number,
	source: string,
): ParseError {
	return new ParseError(
		"TOO_MANY_ARGS",
		`Operator '${op}' accepts at most ${expected} argument(s), got ${actual}`,
		offset,
		length,
		source,
	);
}

/**
 * Executes `outerVarInReduce` with the provided inputs.
 *
 * @param path - The `path` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `outerVarInReduce`.
 *
 * @example
 * outerVarInReduce(path, offset, length, source);
 */

export function outerVarInReduce(
	path: string,
	offset: number,
	length: number,
	source: string,
): ParseError {
	return new ParseError(
		"OUTER_VAR_IN_REDUCE",
		`Cannot access outer variable '${path}' inside reduce lambda. Use var("${path}") to explicitly reference it.`,
		offset,
		length,
		source,
		`Use var("${path}") to explicitly access outer scope`,
	);
}

/**
 * Executes `unknownOperator` with the provided inputs.
 *
 * @param name - The `name` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `unknownOperator`.
 *
 * @example
 * unknownOperator(name, offset, length, source);
 */

export function unknownOperator(
	name: string,
	offset: number,
	length: number,
	source: string,
): ParseError {
	return new ParseError(
		"UNKNOWN_OPERATOR",
		`Unknown operator '${name}'`,
		offset,
		length,
		source,
	);
}

/**
 * Executes `expectedIdentifier` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `expectedIdentifier`.
 *
 * @example
 * expectedIdentifier(offset, source);
 */

export function expectedIdentifier(offset: number, source: string): ParseError {
	return new ParseError(
		"EXPECTED_IDENTIFIER",
		"Expected identifier",
		offset,
		1,
		source,
	);
}

/**
 * Executes `expectedLambdaParam` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `expectedLambdaParam`.
 *
 * @example
 * expectedLambdaParam(offset, source);
 */

export function expectedLambdaParam(
	offset: number,
	source: string,
): ParseError {
	return new ParseError(
		"EXPECTED_LAMBDA_PARAM",
		"Expected lambda parameter name",
		offset,
		1,
		source,
	);
}

/**
 * Executes `invalidObjectKey` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `invalidObjectKey`.
 *
 * @example
 * invalidObjectKey(offset, length, source);
 */

export function invalidObjectKey(
	offset: number,
	length: number,
	source: string,
): ParseError {
	return new ParseError(
		"INVALID_OBJECT_KEY",
		"Object keys must be string literals or identifiers",
		offset,
		length,
		source,
	);
}

/**
 * Executes `unexpectedChar` with the provided inputs.
 *
 * @param offset - The `offset` argument value.
 * @param source - The `source` argument value.
 * @param char - The `char` argument value.
 *
 * @returns The result produced by `unexpectedChar`.
 *
 * @example
 * unexpectedChar(offset, source, char);
 */

export function unexpectedChar(
	offset: number,
	source: string,
	char: string,
): ParseError {
	return new ParseError(
		"UNEXPECTED_CHAR",
		`Unexpected character '${char}'`,
		offset,
		1,
		source,
	);
}
