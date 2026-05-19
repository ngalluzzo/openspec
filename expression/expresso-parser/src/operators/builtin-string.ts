import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	infix,
	type OperatorRegistry,
	prefix,
} from "./registry";

const STRING_FUNCTIONS: FunctionOperatorDef[] = [
	func("split", 2, 2),
	func("cat", 1, null),
	func("substr", 2, 3),
	func("contains", 2, 2),
	func("!contains", 2, 2),
	func("in", 2, 2),
];

const STRING_PREFIXES = [
	prefix("trim"),
	prefix("to_lower"),
	prefix("to_upper"),
	prefix("type"),
	prefix("is_empty"),
];

const STRING_INFIXES = [
	infix("contains", 4),
	infix("!contains", 4),
	infix("in", 4),
];

/**
 * Creates string registry.
 *
 * @returns The result produced by `createStringRegistry`.
 *
 * @example
 * createStringRegistry();
 */

export function createStringRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of STRING_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of STRING_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of STRING_INFIXES) reg = reg.registerInfix(def);
	return reg;
}
