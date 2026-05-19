/**
 * FunctionOperatorDef contract.
 */
export type FunctionOperatorDef = {
	readonly kind: "function";
	readonly ruleKey: string;
	readonly minArgs: number;
	readonly maxArgs: number | null;
	readonly lambdaArgPositions?: readonly number[];
};

/**
 * PrefixOperatorDef contract.
 */
export type PrefixOperatorDef = {
	readonly kind: "prefix-unary";
	readonly ruleKey: string;
};

/**
 * InfixOperatorDef contract.
 */
export type InfixOperatorDef = {
	readonly kind: "infix";
	readonly ruleKey: string;
	readonly precedence: number;
};

/**
 * OperatorDef contract.
 */
export type OperatorDef =
	| FunctionOperatorDef
	| PrefixOperatorDef
	| InfixOperatorDef;

/**
 * OperatorRegistry contract.
 */
export type OperatorRegistry = {
	readonly functions: ReadonlyMap<string, FunctionOperatorDef>;
	readonly prefixes: ReadonlyMap<string, PrefixOperatorDef>;
	readonly infixes: ReadonlyMap<string, InfixOperatorDef>;

	has(name: string): boolean;
	getFunction(name: string): FunctionOperatorDef | undefined;
	getPrefix(name: string): PrefixOperatorDef | undefined;
	getInfix(name: string): InfixOperatorDef | undefined;
	registerFunction(def: FunctionOperatorDef): OperatorRegistry;
	registerPrefix(def: PrefixOperatorDef): OperatorRegistry;
	registerInfix(def: InfixOperatorDef): OperatorRegistry;
};

class OperatorRegistryImpl implements OperatorRegistry {
	readonly functions: Map<string, FunctionOperatorDef>;
	readonly prefixes: Map<string, PrefixOperatorDef>;
	readonly infixes: Map<string, InfixOperatorDef>;

	constructor(
		functions: Map<string, FunctionOperatorDef>,
		prefixes: Map<string, PrefixOperatorDef>,
		infixes: Map<string, InfixOperatorDef>,
	) {
		this.functions = functions;
		this.prefixes = prefixes;
		this.infixes = infixes;
	}

	has(name: string): boolean {
		return (
			this.functions.has(name) ||
			this.prefixes.has(name) ||
			this.infixes.has(name)
		);
	}

	getFunction(name: string): FunctionOperatorDef | undefined {
		return this.functions.get(name);
	}

	getPrefix(name: string): PrefixOperatorDef | undefined {
		return this.prefixes.get(name);
	}

	getInfix(name: string): InfixOperatorDef | undefined {
		return this.infixes.get(name);
	}

	registerFunction(def: FunctionOperatorDef): OperatorRegistry {
		const newFunctions = new Map(this.functions);
		newFunctions.set(def.ruleKey, def);
		return new OperatorRegistryImpl(newFunctions, this.prefixes, this.infixes);
	}

	registerPrefix(def: PrefixOperatorDef): OperatorRegistry {
		const newPrefixes = new Map(this.prefixes);
		newPrefixes.set(def.ruleKey, def);
		return new OperatorRegistryImpl(this.functions, newPrefixes, this.infixes);
	}

	registerInfix(def: InfixOperatorDef): OperatorRegistry {
		const newInfixes = new Map(this.infixes);
		newInfixes.set(def.ruleKey, def);
		return new OperatorRegistryImpl(this.functions, this.prefixes, newInfixes);
	}
}

/**
 * Creates operator registry.
 *
 * @returns The result produced by `createOperatorRegistry`.
 *
 * @example
 * createOperatorRegistry();
 */

export function createOperatorRegistry(): OperatorRegistry {
	return new OperatorRegistryImpl(new Map(), new Map(), new Map());
}

/**
 * Executes `mergeRegistries` with the provided inputs.
 *
 * @param registries - The `registries` argument value.
 *
 * @returns The result produced by `mergeRegistries`.
 *
 * @example
 * mergeRegistries(registries);
 */

export function mergeRegistries(
	...registries: OperatorRegistry[]
): OperatorRegistry {
	const functions = new Map<string, FunctionOperatorDef>();
	const prefixes = new Map<string, PrefixOperatorDef>();
	const infixes = new Map<string, InfixOperatorDef>();

	for (const reg of registries) {
		for (const [k, v] of reg.functions) functions.set(k, v);
		for (const [k, v] of reg.prefixes) prefixes.set(k, v);
		for (const [k, v] of reg.infixes) infixes.set(k, v);
	}

	return new OperatorRegistryImpl(functions, prefixes, infixes);
}

function func(
	ruleKey: string,
	minArgs: number,
	maxArgs: number | null,
	lambdaArgPositions?: readonly number[],
): FunctionOperatorDef {
	return {
		kind: "function",
		ruleKey,
		minArgs,
		maxArgs,
		...(lambdaArgPositions ? { lambdaArgPositions } : {}),
	};
}

function prefix(ruleKey: string): PrefixOperatorDef {
	return { kind: "prefix-unary", ruleKey };
}

function infix(ruleKey: string, precedence: number): InfixOperatorDef {
	return { kind: "infix", ruleKey, precedence };
}

const CORE_FUNCTIONS: FunctionOperatorDef[] = [
	func("or", 1, null),
	func("and", 1, null),
	func("xor", 1, null),
	func("implies", 2, 2),
	func("if", 3, null),
	func("switch", 3, null),
	func("ternary", 3, 3),
	func("coalesce", 1, null),
	func("default", 2, 2),
	func("throw", 1, 4),
	func("try", 2, null),
	func("assert", 2, 2),
	func("var", 1, 2),
	func("missing", 1, 1),
	func("missing_some", 2, 2),
];

const CORE_PREFIXES: PrefixOperatorDef[] = [
	prefix("!"),
	prefix("!!"),
	prefix("exists"),
	prefix("!exists"),
];

const CORE_INFIXES: InfixOperatorDef[] = [
	infix("or", 1),
	infix("||", 1),
	infix("and", 2),
	infix("&&", 2),
	infix("==", 3),
	infix("===", 3),
	infix("!=", 3),
	infix("!==", 3),
	infix("in", 4),
	infix("contains", 4),
	infix("!contains", 4),
	infix(">", 4),
	infix(">=", 4),
	infix("<", 4),
	infix("<=", 4),
	infix("+", 5),
	infix("-", 5),
	infix("*", 6),
	infix("/", 6),
	infix("%", 6),
];

/**
 * Creates core registry.
 *
 * @returns The result produced by `createCoreRegistry`.
 *
 * @example
 * createCoreRegistry();
 */

export function createCoreRegistry(): OperatorRegistry {
	let reg = createOperatorRegistry();
	for (const def of CORE_FUNCTIONS) reg = reg.registerFunction(def);
	for (const def of CORE_PREFIXES) reg = reg.registerPrefix(def);
	for (const def of CORE_INFIXES) reg = reg.registerInfix(def);
	return reg;
}

export { func, prefix, infix };
