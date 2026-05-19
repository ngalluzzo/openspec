import { createAdvancedRegistry } from "./builtin-advanced";
import { createArrayRegistry } from "./builtin-array";
import { createNumericRegistry } from "./builtin-numeric";
import { createObjectRegistry } from "./builtin-object";
import { createStringRegistry } from "./builtin-string";
import { createValidationRegistry } from "./builtin-validation";
import {
	createCoreRegistry,
	createOperatorRegistry,
	type FunctionOperatorDef,
	type InfixOperatorDef,
	mergeRegistries,
	type OperatorDef,
	type OperatorRegistry,
	type PrefixOperatorDef,
} from "./registry";

export function createDefaultRegistry(): OperatorRegistry {
	return mergeRegistries(
		createCoreRegistry(),
		createNumericRegistry(),
		createStringRegistry(),
		createArrayRegistry(),
		createObjectRegistry(),
		createValidationRegistry(),
		createAdvancedRegistry(),
	);
}

export { createCoreRegistry, createOperatorRegistry, mergeRegistries };

export type {
	FunctionOperatorDef,
	InfixOperatorDef,
	OperatorDef,
	OperatorRegistry,
	PrefixOperatorDef,
};
