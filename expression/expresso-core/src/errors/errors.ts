import type { Rule } from "../runtime/contracts/types";

/**
 * ErrorContext contract.
 */
export interface ErrorContext {
	/** rule value. */
	rule: Rule;
	/** data value. */
	data: unknown;
	/** depth value. */
	depth: number;
	/** operator value. */
	operator?: string;
	/** path value. */
	path?: string;
}

/**
 * ErrorSeverity contract.
 */
export type ErrorSeverity = "error" | "warning" | "info";
/**
 * ErrorCode contract.
 */
export type ErrorCode = string;

/**
 * Base error envelope used across parser, runtime, and operator failures.
 *
 * @remarks
 * Severity controls downstream handling (`error` is fatal by default;
 * `warning`/`info` are non-fatal diagnostics).
 */
export class ExpressoError extends Error {
	constructor(
		message: string,
		public readonly code: ErrorCode = "ERR_UNKNOWN",
		public readonly severity: ErrorSeverity = "error",
		public readonly context?: ErrorContext,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace?.(this, ExpressoError);
	}

	toJSON() {
		return {
			name: this.name,
			message: this.message,
			code: this.code,
			severity: this.severity,
			context: this.context
				? {
						rule: this.context.rule,
						depth: this.context.depth,
						operator: this.context.operator,
						path: this.context.path,
					}
				: undefined,
			stack: this.stack,
		};
	}
}

export class RuntimeError extends ExpressoError {
	constructor(
		message: string,
		code: ErrorCode = "ERR_RUNTIME",
		severity: ErrorSeverity = "error",
		context?: ErrorContext,
	) {
		super(message, code, severity, context);
	}
}

export class ValidationError extends ExpressoError {
	constructor(
		message: string,
		code: ErrorCode = "ERR_VALIDATION",
		severity: ErrorSeverity = "warning",
		context?: ErrorContext,
	) {
		super(message, code, severity, context);
	}
}

export class DataError extends ExpressoError {
	constructor(
		message: string,
		code: ErrorCode = "ERR_DATA",
		severity: ErrorSeverity = "error",
		context?: ErrorContext,
	) {
		super(message, code, severity, context);
	}
}

export class OperatorError extends ExpressoError {
	constructor(
		message: string,
		code: ErrorCode = "ERR_OPERATOR",
		severity: ErrorSeverity = "error",
		context?: ErrorContext,
	) {
		super(message, code, severity, context);
	}
}

export class DivisionByZeroError extends RuntimeError {
	constructor(context?: ErrorContext) {
		super("Division by zero", "ERR_DIVISION_BY_ZERO", "error", context);
	}
}

export class MissingFieldError extends DataError {
	constructor(field: string, context?: ErrorContext) {
		super(
			`Missing required field: ${field}`,
			"ERR_MISSING_FIELD",
			"error",
			context,
		);
	}
}

export class TypeMismatchError extends ValidationError {
	constructor(expected: string, actual: string, context?: ErrorContext) {
		super(
			`Type mismatch: expected ${expected}, got ${actual}`,
			"ERR_TYPE_MISMATCH",
			"warning",
			context,
		);
	}
}

export class InvalidValueError extends ValidationError {
	constructor(_value: unknown, reason: string, context?: ErrorContext) {
		super(`Invalid value: ${reason}`, "ERR_INVALID_VALUE", "warning", context);
	}
}

export class IndexOutOfBoundsError extends RuntimeError {
	constructor(index: number, length: number, context?: ErrorContext) {
		super(
			`Index ${index} out of bounds (length: ${length})`,
			"ERR_INDEX_OUT_OF_BOUNDS",
			"error",
			context,
		);
	}
}

/**
 * ExpressoErrorType contract.
 */
export type ExpressoErrorType =
	| ExpressoError
	| RuntimeError
	| ValidationError
	| DataError
	| OperatorError
	| DivisionByZeroError
	| MissingFieldError
	| TypeMismatchError
	| InvalidValueError
	| IndexOutOfBoundsError;

/**
 * Executes `isExpressoError` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `isExpressoError`.
 *
 * @example
 * isExpressoError(error);
 */

export function isExpressoError(error: unknown): error is ExpressoError {
	return error instanceof ExpressoError;
}

/**
 * Executes `getErrorType` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `getErrorType`.
 *
 * @example
 * getErrorType(error);
 */

export function getErrorType(error: ExpressoError): string {
	return error.constructor.name;
}

/**
 * Executes `getErrorSeverity` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `getErrorSeverity`.
 *
 * @example
 * getErrorSeverity(error);
 */

export function getErrorSeverity(error: ExpressoError): ErrorSeverity {
	return error.severity;
}

/**
 * Executes `getErrorCode` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `getErrorCode`.
 *
 * @example
 * getErrorCode(error);
 */

export function getErrorCode(error: ExpressoError): ErrorCode {
	return error.code;
}

/**
 * Executes `isFatal` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `isFatal`.
 *
 * @example
 * isFatal(error);
 */

export function isFatal(error: ExpressoError): boolean {
	return error.severity === "error";
}

/**
 * Executes `isWarning` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `isWarning`.
 *
 * @example
 * isWarning(error);
 */

export function isWarning(error: ExpressoError): boolean {
	return error.severity === "warning";
}

/**
 * Executes `isInfo` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `isInfo`.
 *
 * @example
 * isInfo(error);
 */

export function isInfo(error: ExpressoError): boolean {
	return error.severity === "info";
}
