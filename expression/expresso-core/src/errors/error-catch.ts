import type { Rule } from "../runtime/contracts/types";
import type { ErrorCode, ErrorSeverity, ExpressoError } from "./errors";
import {
	getErrorSeverity,
	getErrorType,
	isFatal,
	isInfo,
	isWarning,
} from "./errors";

/**
 * CatchHandler contract.
 */
export type CatchHandler = {
	readonly type?: string;
	readonly matches?: string | RegExp;
	readonly handler: Rule;
};

/**
 * CaughtError contract.
 */
export type CaughtError = {
	readonly error: ExpressoError;
	readonly handler: Rule;
};

function matchesStringPattern(value: string, pattern: string): boolean {
	const normalizedPattern = pattern.toLowerCase().replaceAll(".*", "").trim();
	if (normalizedPattern.length === 0) {
		return true;
	}
	return value.toLowerCase().includes(normalizedPattern);
}

/**
 * Executes `matchesCatchHandler` with the provided inputs.
 *
 * @param error - The `error` argument value.
 * @param handler - The `handler` argument value.
 *
 * @returns The result produced by `matchesCatchHandler`.
 *
 * @example
 * matchesCatchHandler(error, handler);
 */

export function matchesCatchHandler(
	error: ExpressoError,
	handler: CatchHandler,
): boolean {
	if (handler.type && getErrorType(error) !== handler.type) {
		return false;
	}

	if (handler.matches) {
		const testString = `${error.message} ${error.code}`;
		if (typeof handler.matches === "string") {
			return matchesStringPattern(testString, handler.matches);
		}
		if (handler.matches instanceof RegExp) {
			return handler.matches.test(testString);
		}
		return false;
	}

	return true;
}

/**
 * Executes `findMatchingCatchHandler` with the provided inputs.
 *
 * @param error - The `error` argument value.
 * @param handlers - The `handlers` argument value.
 * @param fallback - The `fallback` argument value.
 *
 * @returns The result produced by `findMatchingCatchHandler`.
 *
 * @example
 * findMatchingCatchHandler(error, handlers, fallback);
 */

export function findMatchingCatchHandler(
	error: ExpressoError,
	handlers: readonly CatchHandler[],
	fallback: Rule,
): { readonly handler: Rule; readonly matched: boolean } {
	for (const handler of handlers) {
		if (matchesCatchHandler(error, handler)) {
			return { handler: handler.handler, matched: true };
		}
	}

	return { handler: fallback, matched: false };
}

/**
 * Executes `isCatchHandler` with the provided inputs.
 *
 * @param input - Composite input payload for this operation.
 *
 * @returns The result produced by `isCatchHandler`.
 *
 * @example
 * isCatchHandler(input);
 */

export function isCatchHandler(input: unknown): input is CatchHandler {
	if (typeof input !== "object" || input === null || Array.isArray(input)) {
		return false;
	}

	const obj = input as Record<string, unknown>;
	return "handler" in obj;
}

/**
 * Parses try args.
 *
 * @param args - Ordered argument values for the operation.
 *
 * @returns The result produced by `parseTryArgs`.
 *
 * @example
 * parseTryArgs(args);
 */

export function parseTryArgs(args: readonly unknown[]): {
	readonly attempt: Rule;
	readonly catchHandlers: readonly CatchHandler[];
	readonly fallback: Rule;
} {
	if (args.length < 2) {
		throw new Error("try operator requires at least 2 arguments");
	}

	const attempt = args[0] as Rule;

	if (args.length === 2) {
		const second = args[1];
		if (isCatchHandler(second)) {
			return {
				attempt,
				catchHandlers: [second],
				fallback: attempt,
			};
		}

		return {
			attempt,
			catchHandlers: [],
			fallback: second as Rule,
		};
	}

	const middleArgs = args.slice(1, -1);
	const fallback = args[args.length - 1] as Rule;

	const catchHandlers: CatchHandler[] = [];
	for (const arg of middleArgs) {
		if (isCatchHandler(arg)) {
			catchHandlers.push(arg);
		} else {
			catchHandlers.push({ handler: arg as Rule });
		}
	}

	return { attempt, catchHandlers, fallback };
}

/**
 * ThrowInput contract.
 */
export type ThrowInput =
	| string
	| readonly [string]
	| readonly [string, ErrorCode]
	| readonly [string, ErrorCode, ErrorSeverity]
	| {
			readonly message: string;
			readonly code?: ErrorCode;
			readonly severity?: ErrorSeverity;
			readonly type?: string;
	  };

/**
 * Parses throw input.
 *
 * @param input - Composite input payload for this operation.
 *
 * @returns The result produced by `parseThrowInput`.
 *
 * @example
 * parseThrowInput(input);
 */

export function parseThrowInput(input: unknown): {
	readonly message: string;
	readonly code: ErrorCode;
	readonly severity?: ErrorSeverity;
	readonly type?: string;
} {
	if (typeof input === "string") {
		return { message: input, code: "ERR_CUSTOM_THROW" };
	}

	if (Array.isArray(input)) {
		if (
			input.length === 1 &&
			typeof input[0] === "object" &&
			input[0] !== null &&
			!Array.isArray(input[0])
		) {
			const obj = input[0];
			return {
				message: obj.message,
				code: obj.code ?? "ERR_CUSTOM_THROW",
				...(obj.severity !== undefined && { severity: obj.severity }),
				...(obj.type !== undefined && { type: obj.type }),
			};
		}

		const message = input[0] as string;
		const code = (input[1] as ErrorCode) ?? "ERR_CUSTOM_THROW";
		const third = input[2] as ErrorSeverity | string | undefined;
		const isSeverity =
			third === "error" || third === "warning" || third === "info";
		const severity = isSeverity ? (third as ErrorSeverity) : undefined;
		const type = isSeverity ? (input[3] as string | undefined) : third;
		return {
			message,
			code,
			...(severity !== undefined && { severity }),
			...(type !== undefined && { type }),
		};
	}

	if (typeof input === "object" && input !== null && !Array.isArray(input)) {
		const obj = input as {
			message: string;
			code?: ErrorCode;
			severity?: ErrorSeverity;
			type?: string;
		};
		return {
			message: obj.message,
			code: obj.code ?? "ERR_CUSTOM_THROW",
			...(obj.severity !== undefined && { severity: obj.severity }),
			...(obj.type !== undefined && { type: obj.type }),
		};
	}

	throw new Error("Invalid throw input");
}

export { getErrorSeverity, getErrorType, isFatal, isInfo, isWarning };
