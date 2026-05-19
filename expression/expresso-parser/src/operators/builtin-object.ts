import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	type OperatorRegistry,
	prefix,
} from "./registry";

const OBJECT_FUNCTIONS: FunctionOperatorDef[] = [
	func("keys", 1, 1),
	func("values", 1, 1),
	func("entries", 1, 1),
	func("transform", 3, 4),
	func("merge_deep", 2, null),
	func("get", 2, 3),
	func("set", 3, 3),
	func("has", 2, 2),
	func("pick", 2, 2),
	func("omit", 2, 2),
];

const OBJECT_PREFIXES = [prefix("keys"), prefix("values"), prefix("entries")];

/**
 * Creates object registry.
 *
 * @returns The result produced by `createObjectRegistry`.
 *
 * @example
 * createObjectRegistry();
 */

export function createObjectRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of OBJECT_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of OBJECT_PREFIXES) reg = reg.registerPrefix(def);
	return reg;
}
