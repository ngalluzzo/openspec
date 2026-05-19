export type ProjectionAction = { artifactNodeId?: string; artifactPath: string; externalState?: unknown; id: string; projectionInputs?: unknown; projectionKind: string; };

export type ProjectionDiagnostic = { code: string; details?: unknown; message: string; severity?: string; };

export type ProjectionExecuteInput = { action: ProjectionAction; graph: unknown; runtime?: unknown; };

export type ProjectionFile = { disposition?: string; mediaType: string; path: string; text: string; };

export type ProjectionOutput = { diagnostics: ProjectionDiagnostic[]; files: ProjectionFile[]; };
