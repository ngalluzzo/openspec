import type {
	DataMarker,
	EvaluationContext,
	EvaluationTrace,
	Rule,
} from "../contracts/types";
import { EvaluationError } from "./engine-errors";

/**
 * DataMarkerValue contract.
 */
export interface DataMarkerValue {
	/** __dataMarker value. */
	__dataMarker: true;
	/** value value. */
	value: unknown;
}

/**
 * Executes `isOperatorRule` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isOperatorRule`.
 *
 * @example
 * isOperatorRule(value);
 */

export function isOperatorRule(
	value: unknown,
	ctx: EvaluationContext,
): value is Rule {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const entries = Object.entries(value);
	const firstEntry = entries[0];
	return (
		entries.length === 1 &&
		firstEntry !== undefined &&
		ctx.operatorRegistry.has(firstEntry[0])
	);
}

/**
 * Determines whether trace.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `shouldTrace`.
 *
 * @example
 * shouldTrace(ctx);
 */

export function shouldTrace(ctx: EvaluationContext): boolean {
	return ctx.debug === true && ctx.trace !== undefined;
}

/**
 * Executes `addTrace` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 * @param trace - The `trace` argument value.
 *
 * @example
 * addTrace(ctx, trace);
 */

export function addTrace(ctx: EvaluationContext, trace: EvaluationTrace): void {
	if (ctx.trace) {
		ctx.trace.push(trace);
	}
}

/**
 * Executes `isValidDataMarker` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isValidDataMarker`.
 *
 * @example
 * isValidDataMarker(value);
 */

export function isValidDataMarker(value: unknown): value is DataMarker {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const entries = Object.entries(value);
	if (entries.length !== 1) {
		return false;
	}

	const firstEntry = entries[0];
	if (!firstEntry) {
		return false;
	}
	const [key] = firstEntry;
	return key === "@data";
}

/**
 * Executes `wrapDataMarker` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `wrapDataMarker`.
 *
 * @example
 * wrapDataMarker(value);
 */

export function wrapDataMarker(value: unknown): DataMarkerValue {
	return { __dataMarker: true, value };
}

/**
 * Executes `isDataMarkerValue` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isDataMarkerValue`.
 *
 * @example
 * isDataMarkerValue(value);
 */

export function isDataMarkerValue(value: unknown): value is DataMarkerValue {
	return (
		typeof value === "object" &&
		value !== null &&
		"__dataMarker" in value &&
		(value as DataMarkerValue).__dataMarker === true
	);
}

/**
 * Executes `unwrapDataMarker` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `unwrapDataMarker`.
 *
 * @example
 * unwrapDataMarker(value);
 */

export function unwrapDataMarker(value: unknown): unknown {
	if (isDataMarkerValue(value)) {
		return value.value;
	}
	return value;
}

/**
 * Validates data marker content.
 *
 * @param content - The `content` argument value.
 * @param rule - The `rule` argument value.
 *
 * @example
 * validateDataMarkerContent(content, rule);
 */

export function validateDataMarkerContent(
	content: unknown,
	rule: DataMarker,
	operatorRegistry: EvaluationContext["operatorRegistry"],
): void {
	if (
		typeof content === "object" &&
		content !== null &&
		!Array.isArray(content)
	) {
		const contentEntries = Object.entries(content);
		if (contentEntries.length === 1) {
			const firstEntry = contentEntries[0];
			if (firstEntry) {
				const [key] = firstEntry;
				if (operatorRegistry.has(key)) {
					throw new EvaluationError(
						`Invalid @data marker: content ${JSON.stringify(content)} appears to be a Rule (single-key object with operator "${key}"). Use multi-key object if you want literal data.`,
						rule,
						0,
					);
				}
			}
		}
	}
}
