const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isSafePathSegment(segment: string): boolean {
	return segment.length > 0 && !UNSAFE_PATH_SEGMENTS.has(segment);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
	return Object.hasOwn(record, key);
}

function getOwnValue(record: Record<string, unknown>, key: string): unknown {
	if (!hasOwn(record, key)) {
		return undefined;
	}

	return Object.getOwnPropertyDescriptor(record, key)?.value;
}

export function getPathValue(
	root: unknown,
	path: string,
	defaultValue?: unknown,
): unknown {
	if (path === "" || path === ".") {
		return root;
	}

	if (path.startsWith("../") || path.startsWith("@")) {
		return defaultValue;
	}

	const parts = path.split(".");
	let current: unknown = root;

	for (const part of parts) {
		if (!isSafePathSegment(part)) {
			return defaultValue;
		}

		if (current === null || current === undefined) {
			return defaultValue;
		}

		if (typeof current !== "object") {
			return defaultValue;
		}

		if (Array.isArray(current)) {
			const index = Number.parseInt(part, 10);
			if (Number.isNaN(index)) {
				return defaultValue;
			}

			current = current.at(index);
			continue;
		}

		current = getOwnValue(current as Record<string, unknown>, part);
		if (current === undefined) {
			return defaultValue;
		}
	}

	return current;
}

export function hasPathValue(root: unknown, path: string): boolean {
	return getPathValue(root, path, undefined) !== undefined;
}

export function expressoLooseEqual(left: unknown, right: unknown): boolean {
	if (left === right) {
		return true;
	}

	if (left === null || right === null) {
		return false;
	}

	if (typeof left === "number" && typeof right === "number") {
		return false;
	}

	// biome-ignore lint/suspicious/noDoubleEquals: intentional Expresso loose equality semantics.
	return left == right;
}

export function expressoLooseNotEqual(left: unknown, right: unknown): boolean {
	if (left === right) {
		return false;
	}

	if (left === null || right === null) {
		return true;
	}

	if (typeof left === "number" && typeof right === "number") {
		return true;
	}

	// biome-ignore lint/suspicious/noDoubleEquals: intentional Expresso loose inequality semantics.
	return left != right;
}

export function mergeArrayValues(values: readonly unknown[]): unknown[] {
	const result: unknown[] = [];
	for (const value of values) {
		if (Array.isArray(value)) {
			result.push(...value);
		}
	}

	return result;
}

export function mergeDeepValues(
	values: readonly unknown[],
): Record<string, unknown> {
	const result: Record<string, unknown> = {};

	for (const value of values) {
		if (typeof value !== "object" || value === null || Array.isArray(value)) {
			continue;
		}

		for (const key of Object.keys(value)) {
			const entry = (value as Record<string, unknown>)[key];
			if (
				typeof entry === "object" &&
				entry !== null &&
				!Array.isArray(entry) &&
				typeof result[key] === "object" &&
				result[key] !== null &&
				!Array.isArray(result[key])
			) {
				result[key] = {
					...(result[key] as Record<string, unknown>),
					...(entry as Record<string, unknown>),
				};
				continue;
			}

			result[key] = entry;
		}
	}

	return result;
}

function cloneJsonRecord(
	input: Record<string, unknown>,
): Record<string, unknown> {
	return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
}

export function setPathValue(
	base: unknown,
	path: string,
	value: unknown,
): Record<string, unknown> {
	const result =
		typeof base === "object" && base !== null && !Array.isArray(base)
			? cloneJsonRecord(base as Record<string, unknown>)
			: {};

	const parts = path.split(".");
	let current: Record<string, unknown> = result;

	for (let index = 0; index < parts.length - 1; index += 1) {
		const segment = parts[index];
		if (!segment || !isSafePathSegment(segment)) {
			return result;
		}

		const next = current[segment];
		if (typeof next !== "object" || next === null || Array.isArray(next)) {
			current[segment] = {};
		}

		current = current[segment] as Record<string, unknown>;
	}

	const finalSegment = parts[parts.length - 1];
	if (!finalSegment || !isSafePathSegment(finalSegment)) {
		return result;
	}

	current[finalSegment] = value;
	return result;
}
