import {
	type ParseOptions,
	parseExpressionOrThrow,
	parseExpressionToRule,
} from "./api/parse";
import { ParseError, type ParseErrorCode } from "./errors/parse-error";
import {
	createCoreRegistry,
	createDefaultRegistry,
	createOperatorRegistry,
	type FunctionOperatorDef,
	type InfixOperatorDef,
	mergeRegistries,
	type OperatorDef,
	type OperatorRegistry,
	type PrefixOperatorDef,
} from "./operators";
import { type Token, TokenKind } from "./tokenizer/token";
import { tokenize } from "./tokenizer/tokenizer";
import type {
	ExpressoEnvelope,
	ParseFailure,
	ParseResult,
	ParseSuccess,
} from "./types/parse-result";

/**
 * Parses source expression into an Expresso rule envelope.
 *
 * @param source - The expression source.
 * @param options - Optional parser configuration.
 *
 * @returns Parse success/failure result.
 */
export function parseExpression(
	source: string,
	options?: ParseOptions,
): ParseResult {
	return parseExpressionToRule(source, options);
}

export {
	createCoreRegistry,
	createDefaultRegistry,
	createOperatorRegistry,
	mergeRegistries,
	parseExpressionOrThrow,
	parseExpressionToRule,
	ParseError,
	tokenize,
	TokenKind,
};

export type {
	ExpressoEnvelope,
	FunctionOperatorDef,
	InfixOperatorDef,
	OperatorDef,
	OperatorRegistry,
	ParseErrorCode,
	ParseFailure,
	ParseOptions,
	ParseResult,
	ParseSuccess,
	PrefixOperatorDef,
	Token,
};
