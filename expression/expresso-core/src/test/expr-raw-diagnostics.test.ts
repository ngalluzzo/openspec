import { describe, expect, test } from "bun:test";
import "./register-std";
import { expr } from "../runtime/compile/expr";
import type { RawExprUsageDiagnostic } from "../runtime/compile/expr-diagnostics";
import {
	createOperatorTypeRegistry,
	type OperatorTypeDescriptor,
} from "../runtime/compile/operator-types";

describe("expr raw usage diagnostics", () => {
	test("tracks raw usages on expressions", () => {
		const e = expr<{ user: { age: number } }>();
		const result = e.opRaw("custom.raw", e.var("user.age"), 1);

		expect(result.diagnostics()).toEqual([
			{
				kind: "opRaw",
				value: "custom.raw",
			},
		]);
	});

	test("warn policy reports diagnostics through callback", () => {
		const observed: RawExprUsageDiagnostic[] = [];
		const e = expr({
			rawUsagePolicy: "warn",
			onDiagnostic(diagnostic) {
				observed.push(diagnostic);
			},
		});

		const rawVar = e.varRaw("../items");
		const rawOp = e.opRaw("custom.warn", rawVar);

		expect(observed).toEqual([
			{ kind: "varRaw", value: "../items" },
			{ kind: "opRaw", value: "custom.warn" },
		]);
		expect(rawOp.diagnostics()).toEqual([
			{ kind: "varRaw", value: "../items" },
			{ kind: "opRaw", value: "custom.warn" },
		]);
	});

	test("error policy forbids raw usage", () => {
		const e = expr({
			rawUsagePolicy: "error",
		});

		expect(() => e.varRaw("../forbidden")).toThrow(
			/forbidden \(varRaw\): \.\.\/forbidden/,
		);
	});

	test("typed operator usage does not produce raw diagnostics", () => {
		const registry = createOperatorTypeRegistry([
			{
				id: "+",
			} as OperatorTypeDescriptor<"+", readonly [number, number], number>,
		] as const);
		const typed = expr<{ value: number }>().withOperators(registry);

		const result = typed.op("+", typed.var("value"), 1);
		expect(result.diagnostics()).toEqual([]);
	});
});
