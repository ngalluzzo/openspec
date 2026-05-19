export type ExecuteFlowRequest = { flow: string; inputs?: unknown; };

export type ExecuteFlowResult = { diagnostics: FlowDiagnostic[]; outputs: unknown; };

export type FlowDiagnostic = { code: string; details?: unknown; message: string; severity?: string; };
