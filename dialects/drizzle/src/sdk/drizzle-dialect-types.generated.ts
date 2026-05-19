export type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";

export type AssetContract = { disposition?: string; id?: string; language?: string; locator?: unknown; mediaType?: string; nodeId?: string; };

export type DrizzleColumnContract = { id: string; identity: boolean; name: string; nullable: boolean; storageField: string; table: string; type: string; unique: boolean; unit: string; };

export type DrizzleRelationContract = { cardinality: string; from: string; id: string; name: string; required?: boolean; storageRelation: string; to: string; unit: string; };

export type DrizzleRelationsSelectorResult = unknown;

export type DrizzleSyntaxRenderInput = { asset: AssetContract; relations: DrizzleRelationContract[]; tables: DrizzleTableContract[]; unit: SyntaxUnitContract; };

export type DrizzleSyntaxRenderSelectorParams = { asset: string; syntaxUnit: string; };

export type DrizzleSyntaxUnitSelectorParams = { unit: string; };

export type DrizzleTableContract = { columns: DrizzleColumnContract[]; id: string; name: string; storageEntity: string; unit: string; };

export type DrizzleTablesSelectorResult = unknown;

export type SyntaxUnitContract = { id?: string; kind?: string; metadata?: unknown; nodeId?: string; role?: string; subject?: string; };
