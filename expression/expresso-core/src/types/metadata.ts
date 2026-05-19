/**
 * OperatorCategory contract.
 */
export type OperatorCategory =
	| "array"
	| "auth"
	| "boolean"
	| "comparisons"
	| "crypto"
	| "provider"
	| "data-access"
	| "date"
	| "logic"
	| "misc"
	| "numeric"
	| "object"
	| "openspec"
	| "regex"
	| "scoring"
	| "string"
	| "type"
	| "validation";

/**
 * ValidationLevel contract.
 */
export type ValidationLevel = "strict" | "loose" | "none";

/**
 * OperatorExample contract.
 */
export interface OperatorExample {
	/** description value. */
	description: string;
	/** input value. */
	input: Record<string, unknown>;
	/** rule value. */
	rule: Record<string, unknown>;
	/** output value. */
	output: unknown | RegExp;
}

/**
 * OperatorTest contract.
 */
export interface OperatorTest {
	/** name value. */
	name: string;
	/** description value. */
	description: string;
	/** input value. */
	input: Record<string, unknown>;
	/** args value. */
	args: unknown[];
	/** expected value. */
	expected: unknown | RegExp;
	/** throws value. */
	throws?: string;
}

/**
 * OperatorMetadata contract.
 */
export interface OperatorMetadata {
	/** id value. */
	id: string;
	/** name value. */
	name: string;
	/** title value. */
	title: string;
	/** description value. */
	description: string;
	/** category value. */
	category: OperatorCategory;
	/** tags value. */
	tags: string[];
	/** examples value. */
	examples: OperatorExample[];
	/** version value. */
	version: string;
	/** deprecated value. */
	deprecated?: boolean;
	/** deprecationMessage value. */
	deprecationMessage?: string;
	/** since value. */
	since?: string;
	/** aliases value. */
	aliases?: string[];
	/** relatedOperators value. */
	relatedOperators?: string[];
	/** eager value. */
	eager?: boolean;
	/** preserveRules value. */
	preserveRules?: boolean;
	/** preserveRawArrays value. */
	preserveRawArrays?: boolean;
	/** complexity value. */
	complexity?: string;
	/** performanceNotes value. */
	performanceNotes?: string;
	/** inputValidation value. */
	inputValidation?: ValidationLevel;
	/** outputValidation value. */
	outputValidation?: ValidationLevel;
	/** tests value. */
	tests?: OperatorTest[];
	/** seeAlso value. */
	seeAlso?: string[];
	/** jsonlogicCompatible value. */
	jsonlogicCompatible?: boolean;
}
