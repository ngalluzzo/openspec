import { expect } from "bun:test";
import type { CompileResult } from "../index.ts";

export function expectDiagnosticCodes(
	result: CompileResult,
	codes: readonly string[],
): void {
	expect(
		result.diagnostics.map((diagnostic) => diagnostic.code).sort(),
	).toEqual([...codes].sort());
}

export function expectNoDiagnostics(result: CompileResult): void {
	expect(result.diagnostics).toEqual([]);
}
