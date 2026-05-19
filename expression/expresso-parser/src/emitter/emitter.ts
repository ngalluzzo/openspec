import type { Rule } from "@gooi/expresso";
import { outerVarInReduce } from "../errors/parse-error";
import type {
	ASTArrayLiteral,
	ASTBinaryExpr,
	ASTCallExpr,
	ASTDataLiteral,
	ASTIdentifier,
	ASTLambda,
	ASTLiteral,
	ASTNode,
	ASTObjectLiteral,
	ASTUnaryExpr,
	ASTVarCall,
} from "../parser/ast";
import type { EmitContext } from "./lambda-context";
import {
	pushMapFilterContext,
	pushReduceContext,
	resolveIdentifier,
} from "./lambda-context";

/**
 * Executes `emit` with the provided inputs.
 *
 * @param node - The `node` argument value.
 * @param ctx - The `ctx` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `emit`.
 *
 * @example
 * emit(node, ctx, source);
 */

export function emit(node: ASTNode, ctx: EmitContext, source: string): Rule {
	switch (node.kind) {
		case "literal":
			return emitLiteral(node);
		case "identifier":
			return emitIdentifier(node, ctx, source);
		case "var-call":
			return emitVarCall(node);
		case "binary":
			return emitBinary(node, ctx, source);
		case "unary":
			return emitUnary(node, ctx, source);
		case "call":
			return emitCall(node, ctx, source);
		case "data":
			return emitData(node, ctx, source);
		case "array":
			return emitArray(node, ctx, source);
		case "object":
			return emitObject(node, ctx, source);
		case "lambda":
			throw new Error("Lambda should be handled by parent call expression");
	}
}

function emitLiteral(node: ASTLiteral): Rule {
	return node.value;
}

function emitIdentifier(
	node: ASTIdentifier,
	ctx: EmitContext,
	source: string,
): Rule {
	try {
		return resolveIdentifier(node.path, ctx, 0, node.path.length);
	} catch (e) {
		if (e instanceof Error && e.message.startsWith("OUTER_VAR_IN_REDUCE:")) {
			const parts = e.message.split(":");
			const offset = Number(parts[1]);
			const length = Number(parts[2]);
			const path = parts[3] ?? "";
			throw outerVarInReduce(path, offset, length, source);
		}
		throw e;
	}
}

function emitVarCall(node: ASTVarCall): Rule {
	return { var: node.path };
}

function emitBinary(
	node: ASTBinaryExpr,
	ctx: EmitContext,
	source: string,
): Rule {
	const left = emit(node.left, ctx, source);
	const right = emit(node.right, ctx, source);
	const op =
		node.operator === "||"
			? "or"
			: node.operator === "&&"
				? "and"
				: node.operator;
	return { [op]: [left, right] };
}

function emitUnary(node: ASTUnaryExpr, ctx: EmitContext, source: string): Rule {
	const operand = emit(node.operand, ctx, source);
	return { [node.operator]: [operand] };
}

function emitCall(node: ASTCallExpr, ctx: EmitContext, source: string): Rule {
	const { callee, args } = node;

	if (callee === "map" || callee === "filter") {
		return emitMapFilter(callee, args, ctx, source);
	}

	if (callee === "reduce") {
		return emitReduce(args, ctx, source);
	}

	const emittedArgs = args.map((arg) => {
		if (arg.kind === "lambda") {
			throw new Error(`Lambda not expected for operator ${callee}`);
		}
		return emit(arg, ctx, source);
	});

	return { [callee]: emittedArgs };
}

function emitMapFilter(
	op: string,
	args: (ASTNode | ASTLambda)[],
	ctx: EmitContext,
	source: string,
): Rule {
	const arrayArg = args[0];
	const lambdaArg = args[1];

	if (!arrayArg || !lambdaArg) {
		throw new Error(`${op} requires 2 arguments`);
	}

	if (lambdaArg.kind !== "lambda") {
		throw new Error(`${op} second argument must be a lambda`);
	}

	const array = emit(arrayArg as ASTNode, ctx, source);
	const newCtx = pushMapFilterContext(ctx, lambdaArg.paramName);
	const body = emit(lambdaArg.body, newCtx, source);

	return { [op]: [array, body] };
}

function emitReduce(
	args: (ASTNode | ASTLambda)[],
	ctx: EmitContext,
	source: string,
): Rule {
	const arrayArg = args[0];
	const lambdaArg = args[1];
	const initialArg = args[2];

	if (!arrayArg || !lambdaArg || !initialArg) {
		throw new Error("reduce requires 3 arguments");
	}

	if (lambdaArg.kind !== "lambda") {
		throw new Error("reduce second argument must be a lambda");
	}

	const array = emit(arrayArg as ASTNode, ctx, source);
	const initial = emit(initialArg as ASTNode, ctx, source);

	const newCtx = pushReduceContext(
		ctx,
		lambdaArg.paramName,
		lambdaArg.secondParamName ?? "accumulator",
	);
	const body = emit(lambdaArg.body, newCtx, source);

	return { reduce: [array, body, initial] };
}

function emitData(
	node: ASTDataLiteral,
	ctx: EmitContext,
	source: string,
): Rule {
	const value = emit(node.value, ctx, source);
	return { "@data": value };
}

function emitArray(
	node: ASTArrayLiteral,
	ctx: EmitContext,
	source: string,
): Rule {
	return node.elements.map((elem) => emit(elem, ctx, source));
}

function emitObject(
	node: ASTObjectLiteral,
	ctx: EmitContext,
	source: string,
): Rule {
	const result: Record<string, Rule> = {};
	for (const entry of node.entries) {
		result[entry.key] = emit(entry.value, ctx, source);
	}
	return result;
}

/**
 * Emits with lambda handling.
 *
 * @param node - The `node` argument value.
 * @param ctx - The `ctx` argument value.
 * @param source - The `source` argument value.
 *
 * @returns The result produced by `emitWithLambdaHandling`.
 *
 * @example
 * emitWithLambdaHandling(node, ctx, source);
 */

export function emitWithLambdaHandling(
	node: ASTLambda,
	ctx: EmitContext,
	source: string,
): Rule {
	const newCtx = pushMapFilterContext(ctx, node.paramName);
	return emit(node.body, newCtx, source);
}
