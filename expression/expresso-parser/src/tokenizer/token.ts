export enum TokenKind {
	Number = "Number",
	String = "String",
	Bool = "Bool",
	Null = "Null",
	Identifier = "Identifier",
	VarKeyword = "VarKeyword",
	DataMarker = "DataMarker",
	EqEq = "EqEq",
	EqEqEq = "EqEqEq",
	BangEq = "BangEq",
	BangEqEq = "BangEqEq",
	Gt = "Gt",
	GtEq = "GtEq",
	Lt = "Lt",
	LtEq = "LtEq",
	AndAnd = "AndAnd",
	OrOr = "OrOr",
	Plus = "Plus",
	Minus = "Minus",
	Star = "Star",
	Slash = "Slash",
	Percent = "Percent",
	Bang = "Bang",
	BangBang = "BangBang",
	LParen = "LParen",
	RParen = "RParen",
	LBrack = "LBrack",
	RBrack = "RBrack",
	LBrace = "LBrace",
	RBrace = "RBrace",
	HashBrace = "HashBrace",
	Colon = "Colon",
	Comma = "Comma",
	Arrow = "Arrow",
	EOF = "EOF",
}

/**
 * Token contract.
 */
export type Token = {
	readonly kind: TokenKind;
	readonly value: string | number | boolean | null;
	readonly start: number;
	readonly end: number;
};

/**
 * Converts input to ken.
 *
 * @param kind - The `kind` argument value.
 * @param value - The `value` argument value.
 * @param start - The `start` argument value.
 * @param end - The `end` argument value.
 *
 * @returns The result produced by `token`.
 *
 * @example
 * token(kind, value, start, end);
 */

export function token(
	kind: TokenKind,
	value: string | number | boolean | null,
	start: number,
	end: number,
): Token {
	return { kind, value, start, end };
}
