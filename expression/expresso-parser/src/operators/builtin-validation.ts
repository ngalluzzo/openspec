import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	infix,
	type OperatorRegistry,
	prefix,
} from "./registry";

const VALIDATION_FUNCTIONS: FunctionOperatorDef[] = [
	func("is_string", 1, 1),
	func("is_boolean", 1, 1),
	func("is_array", 1, 1),
	func("is_object", 1, 1),
	func("is_nan", 1, 1),
	func("is_finite", 1, 1),
	func("is_integer", 1, 1),
	func("is_float", 1, 1),
	func("is_number", 1, 1),
	func("is_finite_number", 1, 1),
	func("is_null", 1, 1),
	func("is_undefined", 1, 1),
	func("is_nil", 1, 1),
	func("required", 1, 1),
	func("matches", 2, 2),
	func("range", 3, 3),
	func("in_range", 3, 3),
	func("min_value", 2, 2),
	func("max_value", 2, 2),
	func("min_length", 2, 2),
	func("max_length", 2, 2),
	func("equals_length", 2, 2),
	func("between_length", 3, 3),
	func("is_email", 1, 1),
	func("is_url", 1, 1),
	func("is_uuid", 1, 1),
];

const VALIDATION_PREFIXES = [
	prefix("is_string"),
	prefix("is_boolean"),
	prefix("is_array"),
	prefix("is_object"),
	prefix("is_nan"),
	prefix("is_finite"),
	prefix("is_integer"),
	prefix("is_float"),
	prefix("is_number"),
	prefix("is_finite_number"),
	prefix("is_null"),
	prefix("is_undefined"),
	prefix("is_nil"),
	prefix("required"),
	prefix("is_email"),
	prefix("is_url"),
	prefix("is_uuid"),
];

const VALIDATION_INFIXES = [
	infix("matches", 4),
	infix("min_value", 4),
	infix("max_value", 4),
	infix("min_length", 4),
	infix("max_length", 4),
	infix("equals_length", 4),
];

/**
 * Creates validation registry.
 *
 * @returns The result produced by `createValidationRegistry`.
 *
 * @example
 * createValidationRegistry();
 */

export function createValidationRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of VALIDATION_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of VALIDATION_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of VALIDATION_INFIXES) reg = reg.registerInfix(def);
	return reg;
}
