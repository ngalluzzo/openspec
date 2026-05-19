import { type AuthContext, authContextSchema } from "./auth-context-schema";

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isSafePathSegment(part: string): boolean {
	return part.length > 0 && !UNSAFE_PATH_SEGMENTS.has(part);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/**
 * Executes `getAuthContext` with the provided inputs.
 *
 * @param data - The `data` argument value.
 *
 * @returns The result produced by `getAuthContext`.
 *
 * @example
 * getAuthContext(data);
 */

export function getAuthContext(data: unknown): AuthContext | undefined {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		return undefined;
	}
	const obj = data as Record<string, unknown>;
	const auth = obj.auth;
	if (!auth || typeof auth !== "object" || Array.isArray(auth)) {
		return undefined;
	}
	const parsed = authContextSchema.safeParse(auth);
	return parsed.success ? parsed.data : undefined;
}

/**
 * Executes `getValueByPath` with the provided inputs.
 *
 * @param data - The `data` argument value.
 * @param path - The `path` argument value.
 *
 * @returns The result produced by `getValueByPath`.
 *
 * @example
 * getValueByPath(data, path);
 */

export function getValueByPath(data: unknown, path: string): unknown {
	if (!path) {
		return data;
	}
	const parts = path.split(".");
	let current: unknown = data;

	for (const part of parts) {
		if (!isSafePathSegment(part)) {
			return undefined;
		}
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== "object") {
			return undefined;
		}
		if (Array.isArray(current)) {
			const index = parseInt(part, 10);
			if (Number.isNaN(index)) {
				return undefined;
			}
			current = (current as readonly unknown[]).at(index);
		} else {
			const record = current as Record<string, unknown>;
			if (!hasOwn(record, part)) {
				return undefined;
			}
			current = record[part];
		}
	}

	return current;
}

/**
 * Creates auth error.
 *
 * @param message - The `message` argument value.
 * @param code - The `code` argument value.
 *
 * @returns The result produced by `createAuthError`.
 *
 * @example
 * createAuthError(message, code);
 */

export function createAuthError(message: string, code: string): Error {
	const error = new Error(message);
	(error as unknown as Record<string, unknown>).code = code;
	return error;
}
