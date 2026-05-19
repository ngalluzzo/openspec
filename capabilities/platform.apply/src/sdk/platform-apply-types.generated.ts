export type ApplyDiagnostic = { code: string; details?: unknown; message: string; severity?: string; };

export type PlatformApplyInput = { config?: unknown; graph: unknown; mutations: unknown; root: string; };

export type PlatformApplyOutput = { applied: PlatformMutationResult[]; diagnostics: ApplyDiagnostic[]; };

export type PlatformMutationResult = { id: string; message?: string; operation: string; status: string; };
