import type { Rule } from "../contracts/types";

/**
 * Executes `optimizeRule` with the provided inputs.
 *
 * @param rule - The `rule` argument value.
 *
 * @returns The result produced by `optimizeRule`.
 *
 * @example
 * optimizeRule(rule);
 */

export function optimizeRule(rule: Rule): Rule {
	if (typeof rule !== "object" || rule === null || Array.isArray(rule)) {
		return rule;
	}

	const entries = Object.entries(rule);
	if (entries.length !== 1) {
		return rule;
	}

	const entry = entries[0];
	if (!entry) {
		return rule;
	}

	const [operator, args] = entry;
	const optimizedArgs = optimizeArgs(args);

	return { [operator]: optimizedArgs } as Rule;
}

function optimizeArgs(args: unknown): unknown {
	if (typeof args !== "object" || args === null) {
		return args;
	}

	if (Array.isArray(args)) {
		return args.map(optimizeArgs);
	}

	const optimized: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(args)) {
		optimized[key] = optimizeArgs(value);
	}

	return optimized as Rule;
}
