import type { Rule } from "../runtime/contracts/types";
import type {
	ErrorCode,
	ErrorContext,
	ErrorSeverity,
	ExpressoError,
	ExpressoErrorType,
} from "./errors";
import {
	DataError,
	DivisionByZeroError,
	getErrorCode,
	getErrorSeverity,
	getErrorType,
	IndexOutOfBoundsError,
	InvalidValueError,
	isExpressoError,
	isFatal,
	isInfo,
	isWarning,
	MissingFieldError,
	OperatorError,
	RuntimeError,
	TypeMismatchError,
	ValidationError,
} from "./errors";

/**
 * Creates error.
 *
 * @param message - The `message` argument value.
 * @param code - The `code` argument value.
 * @param severity - The `severity` argument value.
 * @param type - The `type` argument value.
 * @param context - The `context` argument value.
 *
 * @returns The result produced by `createError`.
 *
 * @example
 * createError(message, code, severity, type, context);
 */

export function createError(
	message: string,
	code: ErrorCode = "ERR_CUSTOM",
	severity?: ErrorSeverity,
	type?: string,
	context?: ErrorContext,
): ExpressoError {
	const error = createErrorInstance(type, message, code, severity, context);
	return error;
}

function createErrorInstance(
	type: string | undefined,
	message: string,
	code: ErrorCode,
	severity: ErrorSeverity | undefined,
	context?: ErrorContext,
): ExpressoErrorType {
	switch (type) {
		case "RuntimeError":
			return new RuntimeError(message, code, severity, context);
		case "ValidationError":
			return new ValidationError(message, code, severity, context);
		case "DataError":
			return new DataError(message, code, severity, context);
		case "OperatorError":
			return new OperatorError(message, code, severity, context);
		case "DivisionByZeroError":
			return new DivisionByZeroError(context);
		case "MissingFieldError":
			return new MissingFieldError(message, context);
		case "TypeMismatchError":
			return new TypeMismatchError("unknown", "unknown", context);
		case "InvalidValueError":
			return new InvalidValueError(message, "unknown", context);
		case "IndexOutOfBoundsError":
			return new IndexOutOfBoundsError(0, 0, context);
		default:
			return new RuntimeError(message, code, severity, context);
	}
}

/**
 * Creates error context.
 *
 * @param rule - The `rule` argument value.
 * @param data - The `data` argument value.
 * @param depth - The `depth` argument value.
 * @param operator - The `operator` argument value.
 * @param path - The `path` argument value.
 *
 * @returns The result produced by `createErrorContext`.
 *
 * @example
 * createErrorContext(rule, data, depth, operator, path);
 */

export function createErrorContext(
	rule: Rule,
	data: unknown,
	depth: number,
	operator?: string,
	path?: string,
): ErrorContext {
	return {
		rule,
		data,
		depth,
		...(operator !== undefined && { operator }),
		...(path !== undefined && { path }),
	};
}

/**
 * Executes `formatError` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `formatError`.
 *
 * @example
 * formatError(error);
 */

export function formatError(error: ExpressoError): string {
	const parts: string[] = [`[${error.code}] ${error.message}`];

	if (error.context) {
		const contextParts: string[] = [];
		if (error.context.depth !== undefined) {
			contextParts.push(`depth: ${error.context.depth}`);
		}
		if (error.context.operator) {
			contextParts.push(`operator: ${error.context.operator}`);
		}
		if (error.context.path) {
			contextParts.push(`path: ${error.context.path}`);
		}
		if (contextParts.length > 0) {
			parts.push(`(${contextParts.join(", ")})`);
		}
	}

	return parts.join(" ");
}

/**
 * Executes `getErrorSummary` with the provided inputs.
 *
 * @param error - The `error` argument value.
 *
 * @returns The result produced by `getErrorSummary`.
 *
 * @example
 * getErrorSummary(error);
 */

export function getErrorSummary(error: ExpressoError): {
	readonly code: ErrorCode;
	readonly message: string;
	readonly type: string;
	readonly severity: ErrorSeverity;
	readonly fatal: boolean;
} {
	return {
		code: error.code,
		message: error.message,
		type: getErrorType(error),
		severity: getErrorSeverity(error),
		fatal: isFatal(error),
	};
}

export {
	getErrorCode,
	getErrorSeverity,
	getErrorType,
	isExpressoError,
	isFatal,
	isInfo,
	isWarning,
};
