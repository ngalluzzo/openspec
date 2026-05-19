import type { Rule } from "@gooi/expresso";
import type { ParseError } from "../errors/parse-error";

/**
 * Expresso envelope contract.
 */
export type ExpressoEnvelope = {
	readonly $expr: Rule;
};

/**
 * ParseSuccess contract.
 */
export type ParseSuccess = {
	readonly ok: true;
	readonly rule: Rule;
	readonly envelope: ExpressoEnvelope;
};

/**
 * ParseFailure contract.
 */
export type ParseFailure = {
	readonly ok: false;
	readonly error: ParseError;
};

/**
 * ParseResult contract.
 */
export type ParseResult = ParseSuccess | ParseFailure;
