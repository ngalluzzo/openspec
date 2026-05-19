/**
 * LambdaContext contract.
 */
export type LambdaContext = {
	readonly kind: "map-filter" | "reduce";
	readonly paramName: string;
	readonly secondParamName?: string;
	readonly depth: number;
};

/**
 * EmitContext contract.
 */
export type EmitContext = {
	readonly lambdaStack: readonly LambdaContext[];
	readonly inReduce: boolean;
};

/**
 * Creates emit context.
 *
 * @returns The result produced by `createEmitContext`.
 *
 * @example
 * createEmitContext();
 */

export function createEmitContext(): EmitContext {
	return { lambdaStack: [], inReduce: false };
}

/**
 * Executes `pushMapFilterContext` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 * @param paramName - The `paramName` argument value.
 *
 * @returns The result produced by `pushMapFilterContext`.
 *
 * @example
 * pushMapFilterContext(ctx, paramName);
 */

export function pushMapFilterContext(
	ctx: EmitContext,
	paramName: string,
): EmitContext {
	const depth = ctx.lambdaStack.length;
	const newLambda: LambdaContext = {
		kind: "map-filter",
		paramName,
		depth: depth + 1,
	};
	return {
		lambdaStack: [...ctx.lambdaStack, newLambda],
		inReduce: ctx.inReduce,
	};
}

/**
 * Executes `pushReduceContext` with the provided inputs.
 *
 * @param ctx - The `ctx` argument value.
 * @param paramName - The `paramName` argument value.
 * @param secondParamName - The `secondParamName` argument value.
 *
 * @returns The result produced by `pushReduceContext`.
 *
 * @example
 * pushReduceContext(ctx, paramName, secondParamName);
 */

export function pushReduceContext(
	ctx: EmitContext,
	paramName: string,
	secondParamName: string,
): EmitContext {
	const depth = ctx.lambdaStack.length;
	const newLambda: LambdaContext = {
		kind: "reduce",
		paramName,
		secondParamName,
		depth: depth + 1,
	};
	return {
		lambdaStack: [...ctx.lambdaStack, newLambda],
		inReduce: true,
	};
}

/**
 * Resolves identifier.
 *
 * @param path - The `path` argument value.
 * @param ctx - The `ctx` argument value.
 * @param offset - The `offset` argument value.
 * @param length - The `length` argument value.
 *
 * @returns The result produced by `resolveIdentifier`.
 *
 * @example
 * resolveIdentifier(path, ctx, offset, length);
 */

export function resolveIdentifier(
	path: string,
	ctx: EmitContext,
	offset: number,
	length: number,
): { var: string } {
	if (ctx.lambdaStack.length === 0) {
		return { var: path };
	}

	const innermost = ctx.lambdaStack[ctx.lambdaStack.length - 1];

	if (!innermost) {
		throw new Error("Innermost not found");
	}

	if (innermost.kind === "reduce") {
		if (
			path === innermost.paramName ||
			path.startsWith(`${innermost.paramName}.`)
		) {
			const remainder =
				path === innermost.paramName
					? ""
					: path.slice(innermost.paramName.length + 1);
			return { var: `accumulator${remainder ? "." : ""}${remainder}` };
		}
		if (
			innermost.secondParamName &&
			(path === innermost.secondParamName ||
				path.startsWith(`${innermost.secondParamName}.`))
		) {
			const remainder =
				path === innermost.secondParamName
					? ""
					: path.slice(innermost.secondParamName.length + 1);
			return { var: `current${remainder ? "." : ""}${remainder}` };
		}
		throw new Error(`OUTER_VAR_IN_REDUCE:${offset}:${length}:${path}`);
	}

	const segments = path.split(".");
	const firstSegment = segments[0];

	if (firstSegment === innermost.paramName) {
		const remainder = segments.slice(1).join(".");
		return { var: remainder };
	}

	const prefix = "../".repeat(innermost.depth);
	return { var: prefix + path };
}
