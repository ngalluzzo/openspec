import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	infix,
	type OperatorRegistry,
	prefix,
} from "./registry";

const NUMERIC_FUNCTIONS: FunctionOperatorDef[] = [
	func("plus", 1, null),
	func("minus", 2, 2),
	func("multiply", 1, null),
	func("divide", 2, 2),
	func("modulo", 2, 2),
	func("abs", 1, 1),
	func("between", 3, 3),
	func("min", 1, null),
	func("max", 1, null),
];

const NUMERIC_PREFIXES = [prefix("abs")];

const NUMERIC_INFIXES = [
	infix("+", 5),
	infix("-", 5),
	infix("*", 6),
	infix("/", 6),
	infix("%", 6),
	infix(">", 4),
	infix(">=", 4),
	infix("<", 4),
	infix("<=", 4),
];

/**
 * Creates numeric registry.
 *
 * @returns The result produced by `createNumericRegistry`.
 *
 * @example
 * createNumericRegistry();
 */

export function createNumericRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of NUMERIC_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of NUMERIC_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of NUMERIC_INFIXES) reg = reg.registerInfix(def);
	return reg;
}
