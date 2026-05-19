export type ContentWrite = { content: string; disposition?: WriteDisposition; location: string; };

export type OverwritePolicy = "error-on-conflict" | "overwrite-generated";

export type WriteBatch = { policy?: OverwritePolicy; root?: string; writes: ContentWrite[]; };

export type WriteDisposition = "generated" | "scaffold";

export type WriteReport = { diagnostics: unknown[]; skipped: string[]; stale: string[]; written: string[]; };
