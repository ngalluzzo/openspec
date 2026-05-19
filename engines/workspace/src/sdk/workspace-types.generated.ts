export type BuildReport = { diagnostics: unknown[]; skipped: string[]; stale: string[]; written: string[]; };

export type BuildRequest = { environment?: string; policy?: string; root: string; };

export type SyncMutationSummary = { breaking: number; created: number; deleted: number; id: string; noop: number; updated: number; };

export type SyncReport = { diagnostics: unknown[]; preview: boolean; summaries: SyncMutationSummary[]; };

export type SyncRequest = { environment?: string; forceBreaking?: boolean; json?: boolean; preview?: boolean; root: string; target?: string; yes?: boolean; };
