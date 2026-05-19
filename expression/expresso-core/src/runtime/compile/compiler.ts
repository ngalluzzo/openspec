import type { OperatorRegistry } from "../../operators/registry";
import { parseRule, validateOperatorArgs } from "../../operators/validation";
import type { Rule } from "../contracts/types";

/**
 * RuleDiagnosticSeverity contract.
 */
export type RuleDiagnosticSeverity = "error" | "warning";

/**
 * Diagnostic produced during static rule analysis.
 *
 * @remarks
 * Paths use a JSONPath-like shape rooted at `$` so diagnostics can be mapped
 * back onto source rules deterministically.
 */
export interface RuleDiagnostic {
	/** code value. */
	readonly code: string;
	/** message value. */
	readonly message: string;
	/** path value. */
	readonly path: string;
	/** severity value. */
	readonly severity: RuleDiagnosticSeverity;
}

/**
 * Controls how static analysis resolves and validates operators.
 *
 * @remarks
 * `resolutionMode: "registry"` enforces currently registered operators,
 * while `"structural"` analyzes shape without requiring registry presence.
 */
export interface AnalyzeRuleOptions {
	readonly operatorRegistry?: OperatorRegistry;
	/** validateArgs value. */
	readonly validateArgs?: boolean;
	/** failOnUnknownRootOperator value. */
	readonly failOnUnknownRootOperator?: boolean;
	/** resolutionMode value. */
	readonly resolutionMode?: "registry" | "structural";
}

/**
 * Canonical static analysis output for a parsed Expresso rule.
 */
export interface RuleAnalysis {
	/** rule value. */
	readonly rule: Rule;
	/** valid value. */
	readonly valid: boolean;
	/** operators value. */
	readonly operators: readonly string[];
	/** operatorCounts value. */
	readonly operatorCounts: Readonly<Record<string, number>>;
	/** variables value. */
	readonly variables: readonly string[];
	/** maxDepth value. */
	readonly maxDepth: number;
	/** diagnostics value. */
	readonly diagnostics: readonly RuleDiagnostic[];
}

/**
 * Strict validation envelope that returns either complete analysis or
 * only diagnostics when errors are present.
 */
export type StrictRuleValidationResult =
	| {
			readonly success: true;
			readonly analysis: RuleAnalysis;
	  }
	| {
			readonly success: false;
			readonly diagnostics: readonly RuleDiagnostic[];
	  };

function asRecord(
	value: unknown,
): Readonly<Record<string, unknown>> | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return undefined;
	}
	return value as Readonly<Record<string, unknown>>;
}

function toPath(base: string, segment: string | number): string {
	if (typeof segment === "number") {
		return `${base}[${segment}]`;
	}

	return base ? `${base}.${segment}` : segment;
}

function toArgs(raw: unknown): readonly unknown[] {
	return Array.isArray(raw) ? raw : [raw];
}

function collectVarPath(raw: unknown): string | undefined {
	if (typeof raw === "string" && raw.length > 0) {
		return raw;
	}

	if (Array.isArray(raw)) {
		const first = raw[0];
		if (typeof first === "string" && first.length > 0) {
			return first;
		}
	}

	return undefined;
}

function pushOperator(
	operatorCounts: Map<string, number>,
	operator: string,
): void {
	operatorCounts.set(operator, (operatorCounts.get(operator) ?? 0) + 1);
}

function containsEvaluatedSubRule(
	operatorRegistry: OperatorRegistry,
	value: unknown,
): boolean {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return false;
	}

	if (Array.isArray(value)) {
		return value.some((item) =>
			containsEvaluatedSubRule(operatorRegistry, item),
		);
	}

	const record = asRecord(value);
	if (!record) {
		return false;
	}

	const entries = Object.entries(record);
	const firstEntry = entries[0];
	if (entries.length === 1 && firstEntry?.[0] === "@data") {
		return false;
	}

	if (
		entries.length === 1 &&
		firstEntry &&
		operatorRegistry.has(firstEntry[0])
	) {
		return true;
	}

	return entries.some(([, child]) =>
		containsEvaluatedSubRule(operatorRegistry, child),
	);
}

/**
 * Executes `analyzeRule` with the provided inputs.
 *
 * @param input - Composite input payload for this operation.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `analyzeRule`.
 *
 * @example
 * analyzeRule(input, options);
 */

export function analyzeRule(
	input: unknown,
	options: AnalyzeRuleOptions = {},
): RuleAnalysis {
	const rule = parseRule(input);
	const seen = new WeakSet<object>();
	const diagnostics: RuleDiagnostic[] = [];
	const operatorCounts = new Map<string, number>();
	const variables = new Set<string>();
	let maxDepth = 0;
	const resolutionMode = options.resolutionMode ?? "registry";
	if (resolutionMode === "registry" && !options.operatorRegistry) {
		throw new Error(
			'Expresso rule analysis with resolutionMode "registry" requires an explicit operator registry.',
		);
	}
	const operatorRegistry = options.operatorRegistry;

	const visit = (node: unknown, path: string, depth: number): void => {
		maxDepth = Math.max(maxDepth, depth);

		if (
			node === null ||
			typeof node === "string" ||
			typeof node === "number" ||
			typeof node === "boolean"
		) {
			return;
		}

		if (Array.isArray(node)) {
			for (const [index, item] of node.entries()) {
				visit(item, toPath(path, index), depth + 1);
			}
			return;
		}

		const record = asRecord(node);
		if (!record) {
			return;
		}

		if (seen.has(record as object)) {
			diagnostics.push({
				code: "EXPRESSO_RULE_CYCLE",
				message: "cyclical object references are not supported in rules",
				path,
				severity: "error",
			});
			return;
		}
		seen.add(record as object);

		const entries = Object.entries(record);
		const firstEntry = entries[0];

		if (entries.length === 1 && firstEntry?.[0] === "@data") {
			return;
		}

		if (entries.length !== 1) {
			if (depth === 0) {
				diagnostics.push({
					code: "EXPRESSO_RULE_ROOT_MULTI_OPERATOR",
					message: `root rule object must contain exactly one operator (got ${entries.length})`,
					path,
					severity: "error",
				});
			}

			for (const [key, value] of entries) {
				visit(value, toPath(path, key), depth + 1);
			}
			return;
		}

		if (!firstEntry) {
			return;
		}

		const [operator, rawArgs] = firstEntry;
		const knownOperator =
			resolutionMode === "structural"
				? true
				: operatorRegistry?.has(operator) === true;

		if (!knownOperator) {
			if (depth === 0 || options.failOnUnknownRootOperator === true) {
				diagnostics.push({
					code: "EXPRESSO_RULE_UNKNOWN_OPERATOR",
					message: `unknown operator "${operator}"`,
					path,
					severity: "error",
				});
			}

			visit(rawArgs, toPath(path, operator), depth + 1);
			return;
		}

		pushOperator(operatorCounts, operator);
		if (operator === "var") {
			const varPath = collectVarPath(rawArgs);
			if (varPath) {
				variables.add(varPath);
			}
		}

		const args = toArgs(rawArgs);
		if (
			options.validateArgs === true &&
			resolutionMode === "registry" &&
			operatorRegistry !== undefined &&
			!containsEvaluatedSubRule(operatorRegistry, args) &&
			!validateOperatorArgs(operatorRegistry, operator, args)
		) {
			diagnostics.push({
				code: "EXPRESSO_RULE_INVALID_ARGS",
				message: `invalid args for operator "${operator}"`,
				path,
				severity: "error",
			});
		}

		for (const [index, arg] of args.entries()) {
			visit(arg, toPath(path, index), depth + 1);
		}
	};

	visit(rule, "$", 0);

	return {
		rule,
		valid: diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
		operators: Array.from(operatorCounts.keys()).sort(),
		operatorCounts: Object.fromEntries(
			Array.from(operatorCounts.entries()).sort((a, b) =>
				a[0].localeCompare(b[0]),
			),
		),
		variables: Array.from(variables).sort(),
		maxDepth,
		diagnostics,
	};
}

/**
 * Validates rule strict.
 *
 * @param input - Composite input payload for this operation.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `validateRuleStrict`.
 *
 * @example
 * validateRuleStrict(input, options);
 */

export function validateRuleStrict(
	input: unknown,
	options: AnalyzeRuleOptions = {},
): StrictRuleValidationResult {
	const analysis = analyzeRule(input, options);
	if (analysis.valid) {
		return {
			success: true,
			analysis,
		};
	}

	return {
		success: false,
		diagnostics: analysis.diagnostics,
	};
}
