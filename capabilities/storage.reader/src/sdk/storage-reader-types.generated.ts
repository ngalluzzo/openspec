export type ContentRead = { content: string; location: string; };

export type ReadQuery = { patterns?: string[]; root: string; };

export type ReadReport = { diagnostics: unknown[]; files: ContentRead[]; };
