export type ActionOutput = { content: string; disposition?: string; location: string; };

export type SyncActionSummary = { breaking: number; created: number; deleted: number; id: string; noop: number; updated: number; };

export type SyncExecutorOutput = { diagnostics: unknown[]; preview: boolean; summaries: SyncActionSummary[]; };
