export type Primitive = string | number | boolean | null;
export type JsonObject = { readonly [key: string]: JsonValue };
export type JsonArray = readonly JsonValue[];
export type JsonValue = Primitive | JsonObject | JsonArray;
export type DataMarker = {
	readonly "@data": unknown;
};
export type Rule =
	| {
			readonly [operator: string]:
				| Rule
				| readonly Rule[]
				| Primitive
				| readonly Primitive[];
	  }
	| readonly Rule[]
	| Primitive
	| DataMarker;

export type EvaluationOptions = {
	readonly operatorRegistry?: OperatorRegistry;
	readonly lazy?: boolean;
	readonly debug?: boolean;
	readonly maxDepth?: number;
	readonly strictErrors?: boolean;
	readonly truthinessMode?: "default" | "jsonlogic" | "python" | "strict";
};

export type OperatorRegistry = {
	register(...args: unknown[]): unknown;
	unregister(...args: unknown[]): unknown;
	get(...args: unknown[]): unknown;
	has(...args: unknown[]): boolean;
	clear(): void;
};

export type OperatorCategory =
	| "access"
	| "auth"
	| "comparison"
	| "crypto"
	| "data"
	| "date"
	| "logic"
	| "misc"
	| "numeric"
	| "object"
	| "regex"
	| "string"
	| "validation"
	| string;

export interface PluginRegistrationContext {
	operatorRegistry: OperatorRegistry;
}

export interface OperatorBinding {
	logicalId: string;
	runtimeId: string;
}

export interface Plugin {
	name: string;
	version: string;
	description?: string;
	category: OperatorCategory;
	operators: string[];
	operatorBindings?: OperatorBinding[];
	dependencies?: string[];
	register: (context: PluginRegistrationContext) => void | Promise<void>;
	unregister?: (context: PluginRegistrationContext) => void | Promise<void>;
}

export type PluginManifestEntry = {
	readonly name: string;
	readonly category: OperatorCategory;
};

export declare function apply<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: EvaluationOptions,
): TOutput;
export declare function evaluate<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: EvaluationOptions,
): TOutput;
export declare function evaluateAsync<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: EvaluationOptions,
): Promise<TOutput>;
export declare function evaluateRule(
	rule: Rule,
	data: unknown,
	options?: EvaluationOptions,
): unknown;
export declare function evaluateRuleAsync(
	rule: Rule,
	data: unknown,
	options?: EvaluationOptions,
): Promise<unknown>;
export declare function isTruthy(
	value: unknown,
	mode?: EvaluationOptions["truthinessMode"],
): boolean;
export declare function parseRule(rule: unknown): Rule;
export declare const ruleSchema: {
	parse(input: unknown): Rule;
	safeParse(input: unknown):
		| { success: true; data: Rule }
		| { success: false; error: unknown };
};
export declare function validateRule(rule: unknown): rule is Rule;

export declare const authPlugin: Plugin;
export declare const comparisonPlugin: Plugin;
export declare const cryptoPlugin: Plugin;
export declare const dataAccessPlugin: Plugin;
export declare const datePlugin: Plugin;
export declare const logicPlugin: Plugin;
export declare const miscPlugin: Plugin;
export declare const numericPlugin: Plugin;
export declare const objectPlugin: Plugin;
export declare const openspecPlugin: Plugin;
export declare const regexPlugin: Plugin;
export declare const stringPlugin: Plugin;
export declare const validationPlugin: Plugin;
export declare const stdPlugins: readonly Plugin[];
export declare const STANDARD_PLUGINS: readonly PluginManifestEntry[];
export declare function loadStandardPlugin(
	nameOrEntry: string | PluginManifestEntry,
): Promise<Plugin | undefined>;

export type ExpressoExpressionEnvelope = {
	readonly $expr: Rule;
};

export declare function expression(rule: Rule): ExpressoExpressionEnvelope;
export declare function isExpressionEnvelope(
	value: unknown,
): value is ExpressoExpressionEnvelope;
export declare function parseExpressionEnvelope(
	value: unknown,
): ExpressoExpressionEnvelope;
export declare function unwrapExpression(
	value: ExpressoExpressionEnvelope,
): Rule;
export declare function toExpressionEnvelope(
	value: unknown,
): ExpressoExpressionEnvelope;

export type ExpressoRuntimeOptions = {
	operatorRegistry?: OperatorRegistry;
};

export type ExpressoRuntime = {
	evaluate(input: {
		expression: unknown;
		context: unknown;
		expressions?: unknown;
	}): Promise<unknown>;
	evaluateSync(input: {
		expression: unknown;
		context: unknown;
		expressions?: unknown;
	}): unknown;
};

export declare function createExpressoRuntime(
	options?: ExpressoRuntimeOptions,
): ExpressoRuntime;

export declare function createStandardOperatorRegistry(): OperatorRegistry;
export declare function getStandardOperatorRegistry(): OperatorRegistry;
export declare function applyStandard<TData = unknown, TOutput = unknown>(
	rule: Rule,
	data: TData,
	options?: Omit<EvaluationOptions, "operatorRegistry">,
): TOutput;
