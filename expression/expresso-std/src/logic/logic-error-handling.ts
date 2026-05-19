import {
	createError,
	createErrorContext,
	defineSyncOperator,
	evaluate,
	findMatchingCatchHandler,
	getErrorType,
	isExpressoError,
	isTruthy,
	parseThrowInput,
	parseTryArgs,
} from "@gooi/expresso-core";
import type {
	EvaluationContext,
	OperatorRegistry,
	Rule,
} from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers throw.
 *
 * @returns The result produced by `registerThrow`.
 *
 * @example
 * registerThrow();
 */

export function registerThrow(operatorRegistry: OperatorRegistry) {
	const register = defineSyncOperator<unknown, unknown>("throw", {
		handler: (input, data, ctx: EvaluationContext) => {
			const parsed = parseThrowInput(input);
			const context = createErrorContext(
				{ throw: input as Rule },
				data,
				ctx.depth,
				"throw",
			);
			const error = createError(
				parsed.message,
				parsed.code,
				parsed.severity,
				parsed.type,
				context,
			);
			throw error;
		},
		inputSchema: z.any(),
		outputSchema: z.any(),
		metadata: {
			name: "throw",
			title: "Throw",
			description:
				"Throw a custom error with optional code, severity, and type. Supports multiple syntax forms: string, [message], [message, code], [message, code, severity], or {message, code, severity, type}",
			category: "logic",
			tags: ["error-handling", "control-flow"],
			examples: [],
			tests: [
				{
					name: "simple-message",
					description: "Simple message",
					input: {},
					args: ["User not found"],
					expected: null,
					throws: "User not found",
				},
				{
					name: "array-form-code",
					description: "Array form with code",
					input: {},
					args: ["Invalid input", "ERR_INVALID_INPUT"],
					expected: null,
					throws: "Invalid input",
				},
				{
					name: "array-form-severity",
					description: "Array form with severity",
					input: {},
					args: ["Missing field", "ERR_MISSING_FIELD", "warning"],
					expected: null,
					throws: "Missing field",
				},
				{
					name: "object-form",
					description: "Object form",
					input: {},
					args: [
						{
							message: "Operation failed",
							code: "ERR_OP_FAILED",
							type: "RuntimeError",
						},
					],
					expected: null,
					throws: "Operation failed",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	});
	register(operatorRegistry);
}

/**
 * Registers try.
 *
 * @returns The result produced by `registerTry`.
 *
 * @example
 * registerTry();
 */

export function registerTry(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<unknown[], unknown>("try", {
		handler: (args, data, ctx: EvaluationContext) => {
			const { attempt, catchHandlers, fallback } = parseTryArgs(args);
			const evaluateRule = (rule: Rule) =>
				evaluate(rule, data, ctx, false, false);

			try {
				return evaluateRule(attempt as Rule);
			} catch (error) {
				if (isExpressoError(error)) {
					const { handler, matched } = findMatchingCatchHandler(
						error,
						catchHandlers,
						fallback,
					);

					if (ctx.caughtErrors) {
						ctx.caughtErrors.push({
							depth: ctx.depth,
							operator: "try",
							error: {
								code: error.code,
								message: error.message,
								severity: error.severity,
								type: getErrorType(error),
							},
							handler,
							timestamp: Date.now(),
						});
					}

					if (!matched && catchHandlers.length > 0) {
						throw error;
					}

					return evaluateRule(handler as Rule);
				}

				return evaluateRule(fallback as Rule);
			}
		},
		inputSchema: z.array(z.any()).min(2),
		outputSchema: z.any(),
		metadata: {
			name: "try",
			title: "Try",
			description:
				"Enhanced try-catch with type and pattern matching. Supports simple fallback or multiple catch handlers with type matching, pattern matching, or both.",
			category: "logic",
			tags: ["error-handling", "control-flow"],
			preserveRules: true,
			examples: [
				{
					description: "Simple fallback",
					input: {},
					rule: { try: [42, "error"] },
					output: 42,
				},
				{
					description: "Type-based catching",
					input: {},
					rule: {
						try: [
							{ throw: ["Not found", "ERR_NOT_FOUND", "DataError"] },
							{ type: "DataError", handler: "Data error handler" },
							{ type: "ValidationError", handler: "Validation error handler" },
							"Default fallback",
						],
					},
					output: "Data error handler",
				},
				{
					description: "Pattern matching",
					input: {},
					rule: {
						try: [
							{ throw: ["Missing field", "ERR_MISSING"] },
							{ matches: ".*missing.*", handler: "Missing handler" },
							{ matches: "ERR_INVALID.*", handler: "Invalid handler" },
							"Default fallback",
						],
					},
					output: "Missing handler",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers assert.
 *
 * @returns The result produced by `registerAssert`.
 *
 * @example
 * registerAssert();
 */

export function registerAssert(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown, unknown], unknown>("assert", {
		handler: ([condition, message], data, ctx: EvaluationContext) => {
			if (!isTruthy(condition, ctx.truthinessMode)) {
				const parsed = parseThrowInput(message);
				const context = createErrorContext(
					{ assert: message } as Rule,
					data,
					ctx.depth,
					"assert",
				);
				const error = createError(
					typeof parsed.message === "string"
						? parsed.message
						: "Assertion failed",
					parsed.code || "ASSERTION_FAILED",
					"error",
					parsed.type || "AssertionError",
					context,
				);
				throw error;
			}
			return condition;
		},
		inputSchema: z.tuple([z.any(), z.any()]),
		outputSchema: z.any(),
		metadata: {
			name: "assert",
			title: "Assert",
			description:
				"Assert operator - throws an error if condition is falsy, otherwise returns the condition value. Useful for precondition validation.",
			category: "logic",
			tags: ["error-handling", "validation", "control-flow"],
			examples: [
				{
					description: "Condition is true, return value",
					input: {},
					rule: { assert: [true, "This should not throw"] },
					output: true,
				},
				{
					description: "Validate field exists",
					input: { user: { name: "John" } },
					rule: {
						assert: [
							{ var: "user.name" },
							["User name is required", "ERR_MISSING_NAME"],
						],
					},
					output: "John",
				},
			],
			tests: [
				{
					name: "condition-false",
					description: "Condition is false, throw error",
					input: {},
					args: [false, "Invalid state"],
					expected: null,
					throws: "Invalid state",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
