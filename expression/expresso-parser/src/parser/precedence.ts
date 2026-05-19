export const INFIX_PRECEDENCE: ReadonlyMap<string, number> = new Map([
	["or", 1],
	["||", 1],
	["and", 2],
	["&&", 2],
	["==", 3],
	["===", 3],
	["!=", 3],
	["!==", 3],
	["in", 4],
	["contains", 4],
	["!contains", 4],
	[">", 4],
	[">=", 4],
	["<", 4],
	["<=", 4],
	["+", 5],
	["-", 5],
	["*", 6],
	["/", 6],
	["%", 6],
]);

/**
 * Executes `getInfixPrecedence` with the provided inputs.
 *
 * @param op - The `op` argument value.
 *
 * @returns The result produced by `getInfixPrecedence`.
 *
 * @example
 * getInfixPrecedence(op);
 */

export function getInfixPrecedence(op: string): number {
	return INFIX_PRECEDENCE.get(op) ?? 0;
}
