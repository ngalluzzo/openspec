import type { TruthinessMode } from "../contracts/types";

/**
 * Executes `isPrimitive` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isPrimitive`.
 *
 * @example
 * isPrimitive(value);
 */

export function isPrimitive(
	value: unknown,
): value is string | number | boolean | null {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

/**
 * Executes `isStaticArray` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isStaticArray`.
 *
 * @example
 * isStaticArray(value);
 */

export function isStaticArray(
	value: unknown,
): value is readonly (string | number | boolean | null)[] {
	if (!Array.isArray(value)) {
		return false;
	}

	return value.every((item) => isPrimitive(item));
}

/**
 * Executes `isTruthy` with the provided inputs.
 *
 * @param value - The `value` argument value.
 * @param mode - The `mode` argument value.
 *
 * @returns The result produced by `isTruthy`.
 *
 * @example
 * isTruthy(value, mode);
 */

export function isTruthy(
	value: unknown,
	mode: TruthinessMode = "default",
): boolean {
	switch (mode) {
		case "default":
			return Boolean(value);

		case "jsonlogic":
			if (value === null || value === undefined) {
				return false;
			}
			if (value === false) {
				return false;
			}
			if (value === 0) {
				return false;
			}
			if (value === "") {
				return false;
			}
			return true;

		case "python":
			if (value === null || value === undefined) {
				return false;
			}
			if (value === false) {
				return false;
			}
			if (value === 0 || value === 0.0) {
				return false;
			}
			if (typeof value === "number" && Number.isNaN(value)) {
				return false;
			}
			if (value === "") {
				return false;
			}
			if (Array.isArray(value) && value.length === 0) {
				return false;
			}
			if (typeof value === "object" && !Array.isArray(value)) {
				const keys: readonly unknown[] = Object.keys(value);
				return keys.length > 0;
			}
			return true;

		case "strict":
			return value === true;

		default:
			return Boolean(value);
	}
}

/**
 * Executes `isPlainObject` with the provided inputs.
 *
 * @param value - The `value` argument value.
 *
 * @returns The result produced by `isPlainObject`.
 *
 * @example
 * isPlainObject(value);
 */

export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return (
		typeof value === "object" &&
		value !== null &&
		!Array.isArray(value) &&
		value.constructor === Object
	);
}

/**
 * Executes `deepClone` with the provided inputs.
 *
 * @param obj - The `obj` argument value.
 *
 * @returns The result produced by `deepClone`.
 *
 * @example
 * deepClone(obj);
 */

export function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(deepClone) as T;
	}

	const result: Record<string, unknown> = {};
	for (const key in obj) {
		if (Object.hasOwn(obj, key)) {
			result[key] = deepClone((obj as Record<string, unknown>)[key]);
		}
	}

	return result as T;
}

/**
 * Executes `deepEqual` with the provided inputs.
 *
 * @param a - The `a` argument value.
 * @param b - The `b` argument value.
 *
 * @returns The result produced by `deepEqual`.
 *
 * @example
 * deepEqual(a, b);
 */

export function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}

	if (a === null || b === null) {
		return false;
	}

	if (typeof a !== typeof b) {
		return false;
	}

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) {
			return false;
		}
		return a.every((item, index) => deepEqual(item, b[index]));
	}

	if (typeof a === "object") {
		const keysA = Object.keys(a);
		const keysB = Object.keys(b as object);

		if (keysA.length !== keysB.length) {
			return false;
		}

		return keysA.every((key) =>
			deepEqual(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
			),
		);
	}

	return false;
}
