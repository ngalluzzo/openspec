import {
	createOperatorRegistry,
	type FunctionOperatorDef,
	func,
	type OperatorRegistry,
	prefix,
} from "./registry";

const MISC_FUNCTIONS: FunctionOperatorDef[] = [
	func("log", 1, null),
	func("exists", 1, 1),
	func("!exists", 1, 1),
];

const MISC_PREFIXES = [prefix("exists"), prefix("!exists")];

const CRYPTO_FUNCTIONS: FunctionOperatorDef[] = [
	func("hash", 2, 2),
	func("hmac", 3, 3),
	func("uuid_generate", 0, 0),
	func("uuid_validate", 1, 1),
	func("base64_encode", 1, 1),
	func("base64_decode", 1, 1),
];

const CRYPTO_PREFIXES = [
	prefix("uuid_validate"),
	prefix("base64_encode"),
	prefix("base64_decode"),
];

const DATE_FUNCTIONS: FunctionOperatorDef[] = [
	func("now", 0, 0),
	func("to_datetime", 1, 1),
	func("date_parse", 1, 1),
	func("date_format", 2, 2),
	func("date_between", 3, 3),
	func("is_weekday", 1, 1),
	func("is_weekend", 1, 1),
	func("date_add", 3, 3),
	func("date_diff", 3, 3),
];

const DATE_PREFIXES = [
	prefix("to_datetime"),
	prefix("date_parse"),
	prefix("is_weekday"),
	prefix("is_weekend"),
];

const REGEX_FUNCTIONS: FunctionOperatorDef[] = [
	func("regex_match", 2, 2),
	func("regex_replace", 3, 3),
	func("regex_extract", 2, 2),
	func("regex_test", 2, 2),
	func("regex_matches", 2, 2),
];

const AUTH_FUNCTIONS: FunctionOperatorDef[] = [
	func("auth_is_authenticated", 0, 0),
	func("auth_is_owner", 1, 1),
	func("auth_is_tenant_member", 1, 1),
	func("auth_has_scope", 1, 1),
	func("auth_claim_equals", 2, 2),
	func("auth_claim_includes", 2, 2),
	func("auth_has_role", 1, 1),
	func("auth_has_any_role", 1, 1),
	func("auth_has_all_roles", 1, 1),
	func("auth_has_permission", 1, 1),
	func("auth_has_any_permission", 1, 1),
	func("auth_has_all_permissions", 1, 1),
	func("auth_attribute_match", 1, 1, [0]),
	func("auth_deny", 0, 1),
	func("auth_allow", 0, 0),
];

/**
 * Creates advanced registry.
 *
 * @returns The result produced by `createAdvancedRegistry`.
 *
 * @example
 * createAdvancedRegistry();
 */

export function createAdvancedRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of MISC_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of MISC_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of CRYPTO_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of CRYPTO_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of DATE_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of DATE_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of REGEX_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of AUTH_FUNCTIONS) reg = reg.registerFunction(def);
	return reg;
}
