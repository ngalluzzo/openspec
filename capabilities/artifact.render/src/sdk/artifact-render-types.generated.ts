export type ArtifactRenderDiagnostic = { code: string; details?: unknown; message: string; severity?: string; };

export type ArtifactRenderDisposition = "generated" | "scaffold";

export type ArtifactRenderFile = { disposition?: ArtifactRenderDisposition; mediaType: string; path?: string; text: string; };

export type ArtifactRenderInput = { recipe: ArtifactRenderRecipe; };

export type ArtifactRenderOutput = { diagnostics: ArtifactRenderDiagnostic[]; files: ArtifactRenderFile[]; };

export type ArtifactRenderRecipe = TextFileArtifactRecipe;

export type TextFileArtifactRecipe = { disposition?: ArtifactRenderDisposition; kind: "text.file"; mediaType?: string; path?: string; text: string; };
