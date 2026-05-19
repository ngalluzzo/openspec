export type AssetContract = { disposition?: string; id?: string; language?: string; locator?: unknown; mediaType?: string; nodeId?: string; };

export type ProviderSelectionContract = { adapter?: string; dialect?: string; id?: string; offering?: string; params?: unknown; projectionKind?: string; provider?: string; request?: string; role?: string; target?: string; };

export type SyntaxUnitContract = { id?: string; kind?: string; metadata?: unknown; nodeId?: string; role?: string; subject?: string; };

export type ZodFieldContract = { id: string; identity: boolean; name: string; nullable: boolean; schema: string; storageField: string; type: string; unit: string; };

export type ZodSchemaContract = { fields: ZodFieldContract[]; id: string; name: string; storageEntity: string; unit: string; };

export type ZodSchemasSelectorResult = unknown;

export type ZodSyntaxRenderInput = { asset: AssetContract; schemas: ZodSchemaContract[]; selections?: ProviderSelectionContract[]; unit: SyntaxUnitContract; };

export type ZodSyntaxRenderSelectorParams = { asset: string; syntaxUnit: string; };

export type ZodSyntaxUnitSelectorParams = { unit: string; };

export type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";
