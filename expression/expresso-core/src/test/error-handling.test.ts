import { beforeEach, describe, expect, test } from "bun:test";
import "./register-std";
import { clearRegistry } from "../operators/registry";
import { pluginRegistry } from "../plugin/registry";
import { init } from "../runtime/bootstrap/init";
import { apply, applyDebug } from "../runtime/compile/apply";
import type { Rule } from "../runtime/contracts/types";

type ErrorWithCode = Error & { code: string };
type ErrorWithSeverity = Error & { severity: string };
type ErrorWithContext = Error & {
	context: { operator: string; depth: number; rule: unknown };
};

describe("Error Handling", () => {
	beforeEach(async () => {
		clearRegistry();
		pluginRegistry.clear();
		await init();
	});

	describe("throw operator", () => {
		test("should throw simple message", () => {
			const rule = { throw: "User not found" };
			expect(() => apply(rule, {})).toThrow("User not found");
		});

		test("should throw with array form [message, code]", () => {
			const rule = { throw: ["Invalid input", "ERR_INVALID_INPUT"] };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).message).toBe("Invalid input");
				expect((error as ErrorWithCode).code).toBe("ERR_INVALID_INPUT");
			}
		});

		test("should throw with array form [message, code, severity]", () => {
			const rule = { throw: ["Warning message", "ERR_WARNING", "warning"] };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).message).toBe("Warning message");
				expect((error as ErrorWithCode).code).toBe("ERR_WARNING");
				expect((error as ErrorWithSeverity).severity).toBe("warning");
			}
		});

		test("should throw with object form", () => {
			const rule = {
				throw: {
					message: "Operation failed",
					code: "ERR_OP_FAILED",
					type: "RuntimeError",
				},
			};
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).message).toBe("Operation failed");
				expect((error as ErrorWithCode).code).toBe("ERR_OP_FAILED");
				expect((error as Error).constructor.name).toBe("RuntimeError");
			}
		});
	});

	describe("Error types", () => {
		test("should throw RuntimeError by default", () => {
			const rule = { throw: ["Error", "ERR_ERROR"] };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as Error).constructor.name).toBe("RuntimeError");
				expect((error as ErrorWithCode).code).toBe("ERR_ERROR");
			}
		});

		test("should throw DataError when type specified", () => {
			const rule = { throw: { message: "Data error", type: "DataError" } };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as Error).constructor.name).toBe("DataError");
			}
		});

		test("should throw ValidationError when type specified", () => {
			const rule = {
				throw: { message: "Validation error", type: "ValidationError" },
			};
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as Error).constructor.name).toBe("ValidationError");
				expect((error as ErrorWithSeverity).severity).toBe("warning");
			}
		});

		test("should throw OperatorError when type specified", () => {
			const rule = {
				throw: { message: "Operator error", type: "OperatorError" },
			};
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as Error).constructor.name).toBe("OperatorError");
			}
		});
	});

	describe("Error codes", () => {
		test("should use default error code for simple throws", () => {
			const rule = { throw: "Error" };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).code).toBe("ERR_CUSTOM_THROW");
			}
		});

		test("should use provided error code", () => {
			const rule = { throw: ["Error", "CUSTOM_CODE"] };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).code).toBe("CUSTOM_CODE");
			}
		});
	});

	describe("Error context", () => {
		test("should include error context", () => {
			const rule = { throw: ["Error", "ERR_ERROR"] };
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithContext).context).toBeDefined();
				expect((error as ErrorWithContext).context.operator).toBe("throw");
				expect((error as ErrorWithContext).context.depth).toBeDefined();
				expect((error as ErrorWithContext).context.rule).toBeDefined();
			}
		});
	});

	describe("try operator - simple fallback", () => {
		test("should return value when no error", () => {
			const rule = { try: [42, "error"] };
			const result = apply(rule, {});
			expect(result).toBe(42);
		});

		test("should return fallback when throw throws in same expression", () => {
			const rule = {
				try: [{ throw: ["Failed", "ERR_FAILED"] }, "fallback value"],
			};
			const result = apply(rule, {});
			expect(result).toBe("fallback value");
		});
	});

	describe("Error handling with other operators", () => {
		test("should work with if operator", () => {
			const rule = {
				if: [
					false,
					{ throw: ["Should not throw", "ERR_NO_THROW"] },
					"safe result",
				],
			};
			const result = apply(rule, {});
			expect(result).toBe("safe result");
		});

		test("should work with and/or operators", () => {
			const rule = {
				and: [true, { try: [42, "error"] }],
			};
			const result = apply(rule, {});
			expect(result).toBe(42);
		});
	});

	describe("Nested error handling", () => {
		test("should propagate errors when not caught", () => {
			const rule = {
				try: [
					{ throw: ["Inner error", "ERR_INNER"] },
					{ type: "ValidationError", handler: "Wrong handler" },
				],
			} as Rule;
			try {
				apply(rule, {});
				expect(true).toBe(false);
			} catch (error) {
				expect((error as ErrorWithCode).code).toBe("ERR_INNER");
			}
		});

		test("matches catch handler string patterns", () => {
			const rule = {
				try: [
					{ throw: ["Missing field", "ERR_MISSING_FIELD"] },
					{ matches: ".*missing.*", handler: "handled-by-pattern" },
					"fallback",
				],
			} as Rule;

			expect(apply(rule, {})).toBe("handled-by-pattern");
		});
	});

	describe("Error handling in debug mode", () => {
		test("should track caught errors when collectErrors is true", () => {
			const rule = {
				try: [{ throw: ["Failed", "ERR_FAILED"] }, "fallback"],
			};
			const { result, caughtErrors } = applyDebug(
				rule,
				{},
				{ collectErrors: true },
			);

			expect(result).toBe("fallback");
			expect(caughtErrors).toBeDefined();
			expect(caughtErrors?.length).toBeGreaterThan(0);
			expect(caughtErrors?.[0]?.error.code).toBe("ERR_FAILED");
		});

		test("should not track errors when collectErrors is false", () => {
			const rule = {
				try: [{ throw: ["Failed", "ERR_FAILED"] }, "fallback"],
			};
			const { result, caughtErrors } = applyDebug(rule, {});

			expect(result).toBe("fallback");
			expect(caughtErrors).toBeUndefined();
		});
	});
});
