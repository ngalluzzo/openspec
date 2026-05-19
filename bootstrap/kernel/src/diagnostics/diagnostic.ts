import type { Diagnostic, DiagnosticSeverity } from "./types.ts";

export type DiagnosticInput = Omit<Diagnostic, "severity"> & {
	severity?: DiagnosticSeverity;
};

export function diagnostic(input: DiagnosticInput): Diagnostic {
	return {
		severity: input.severity ?? "error",
		code: input.code,
		message: input.message,
		...(input.source ? { source: input.source } : {}),
		...(input.details ? { details: input.details } : {}),
	};
}

export function error(input: Omit<DiagnosticInput, "severity">): Diagnostic {
	return diagnostic({ ...input, severity: "error" });
}

export function warning(input: Omit<DiagnosticInput, "severity">): Diagnostic {
	return diagnostic({ ...input, severity: "warning" });
}

export function info(input: Omit<DiagnosticInput, "severity">): Diagnostic {
	return diagnostic({ ...input, severity: "info" });
}
