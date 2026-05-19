export type PlatformMutation = { breaking: boolean; id: string; kind: string; label: string; operation: string; payload: unknown; supported?: boolean; };

export type SyncAction = { config?: unknown; externalState: unknown; id: string; syncKind: string; };

export type SyncDiagnostic = { code: string; details?: unknown; message: string; severity?: string; };

export type SyncInput = { action: SyncAction; graph: unknown; runtime?: unknown; };

export type SyncOutput = { diagnostics: SyncDiagnostic[]; mutations: PlatformMutation[]; };
