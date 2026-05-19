import type {
	EvaluationContext,
	EvaluationOptions,
	IterationMetadata,
	Scope,
} from "@gooi/expresso-core";

const UNSAFE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isSafePathSegment(part: string): boolean {
	return part.length > 0 && !UNSAFE_PATH_SEGMENTS.has(part);
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/**
 * Builds eval opts.
 *
 * @param ctx - The `ctx` argument value.
 *
 * @returns The result produced by `buildEvalOpts`.
 *
 * @example
 * buildEvalOpts(ctx);
 */

export function buildEvalOpts(ctx: EvaluationContext): EvaluationOptions {
	if (ctx.lazy !== undefined && ctx.truthinessMode !== undefined) {
		return {
			debug: false,
			lazy: ctx.lazy,
			truthinessMode: ctx.truthinessMode,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
		};
	}
	if (ctx.lazy !== undefined) {
		return {
			debug: false,
			lazy: ctx.lazy,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
		};
	}
	if (ctx.truthinessMode !== undefined) {
		return {
			debug: false,
			truthinessMode: ctx.truthinessMode,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
		};
	}
	return {
		debug: false,
		operatorRegistry: ctx.operatorRegistry,
		maxDepth: ctx.maxDepth,
		strictErrors: ctx.strictErrors,
	};
}

/**
 * Builds eval opts with scopes.
 *
 * @param ctx - The `ctx` argument value.
 * @param scopes - The `scopes` argument value.
 *
 * @returns The result produced by `buildEvalOptsWithScopes`.
 *
 * @example
 * buildEvalOptsWithScopes(ctx, scopes);
 */

export function buildEvalOptsWithScopes(
	ctx: EvaluationContext,
	scopes: readonly Scope[],
): EvaluationOptions {
	if (ctx.lazy !== undefined && ctx.truthinessMode !== undefined) {
		return {
			debug: false,
			lazy: ctx.lazy,
			truthinessMode: ctx.truthinessMode,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
			scopes,
		};
	}
	if (ctx.lazy !== undefined) {
		return {
			debug: false,
			lazy: ctx.lazy,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
			scopes,
		};
	}
	if (ctx.truthinessMode !== undefined) {
		return {
			debug: false,
			truthinessMode: ctx.truthinessMode,
			operatorRegistry: ctx.operatorRegistry,
			maxDepth: ctx.maxDepth,
			strictErrors: ctx.strictErrors,
			scopes,
		};
	}
	return {
		debug: false,
		operatorRegistry: ctx.operatorRegistry,
		maxDepth: ctx.maxDepth,
		strictErrors: ctx.strictErrors,
		scopes,
	};
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
	if (path === "") {
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
 * Executes `getValueByPathWithScope` with the provided inputs.
 *
 * @param scopes - The `scopes` argument value.
 * @param path - The `path` argument value.
 *
 * @returns The result produced by `getValueByPathWithScope`.
 *
 * @example
 * getValueByPathWithScope(scopes, path);
 */

export function getValueByPathWithScope(
	scopes: readonly Scope[] | undefined,
	path: string,
): unknown {
	if (!scopes || scopes.length === 0) {
		return undefined;
	}

	const currentScope = scopes[scopes.length - 1];
	if (!currentScope) {
		return undefined;
	}

	if (path === "" || path === ".") {
		return currentScope.data;
	}

	if (path.startsWith("../")) {
		const levelsUp = (path.match(/\.\.\//g) || []).length;
		const remainingPath = path.replace(/^(?:\.\.\/)+/, "");

		if (levelsUp >= scopes.length) {
			return undefined;
		}

		const targetScopeIndex = scopes.length - 1 - levelsUp;
		const targetScope = scopes[targetScopeIndex];
		if (!targetScope) {
			return undefined;
		}

		if (remainingPath === "") {
			return targetScope.data;
		}

		return getValueByPath(targetScope.data, remainingPath);
	}

	if (path.startsWith(".")) {
		const normalizedPath = path.replace(/^\./, "");
		return getValueByPath(currentScope.data, normalizedPath);
	}

	return getValueByPath(currentScope.data, path);
}

/**
 * Executes `getIterationMetadata` with the provided inputs.
 *
 * @param scopes - The `scopes` argument value.
 * @param key - The `key` argument value.
 *
 * @returns The result produced by `getIterationMetadata`.
 *
 * @example
 * getIterationMetadata(scopes, key);
 */

export function getIterationMetadata(
	scopes: readonly Scope[] | undefined,
	key: string,
): unknown {
	if (!scopes || scopes.length === 0) {
		return undefined;
	}

	const currentScope = scopes[scopes.length - 1];
	if (!currentScope) {
		return undefined;
	}

	if (!currentScope.iteration) {
		return undefined;
	}

	const metadata: IterationMetadata = currentScope.iteration;

	switch (key) {
		case "@index":
			return metadata.index;
		case "@first":
			return metadata.first;
		case "@last":
			return metadata.last;
		case "@total":
			return metadata.total;
		default:
			return undefined;
	}
}
