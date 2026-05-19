import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	type OperatorRegistry,
	prefix,
} from "./registry";

const ARRAY_FUNCTIONS: FunctionOperatorDef[] = [
	func("map", 2, 2, [1]),
	func("reduce", 3, 3, [1]),
	func("filter", 2, 2, [1]),
	func("find", 2, 2, [1]),
	func("find_index", 2, 2, [1]),
	func("group_by", 2, 2),
	func("all", 2, 2, [1]),
	func("none", 2, 2, [1]),
	func("some", 2, 2, [1]),
	func("merge", 1, null),
	func("flatten", 1, 1),
	func("unique", 1, 1),
	func("sort", 1, 1),
	func("sort_by", 2, 2),
	func("intersection", 2, null),
	func("difference", 2, 2),
	func("union", 2, null),
];

const ARRAY_PREFIXES = [prefix("flatten"), prefix("unique"), prefix("sort")];

/**
 * Creates array registry.
 *
 * @returns The result produced by `createArrayRegistry`.
 *
 * @example
 * createArrayRegistry();
 */

export function createArrayRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of ARRAY_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of ARRAY_PREFIXES) reg = reg.registerPrefix(def);
	return reg;
}
