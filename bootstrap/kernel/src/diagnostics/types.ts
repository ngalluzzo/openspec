export type DiagnosticSeverity = "error" | "warning" | "info";

export type DiagnosticSource = {
	path?: string;
	range?: {
		start: number;
		end: number;
	};
};

export type Diagnostic = {
	severity: DiagnosticSeverity;
	code: string;
	message: string;
	source?: DiagnosticSource;
	details?: Record<string, unknown>;
};
