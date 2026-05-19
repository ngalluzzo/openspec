export type { TextFileArtifactRecipe } from "@openspec/artifact-render-capability/types";

export type AssetContract = { disposition?: string; id?: string; language?: string; locator?: unknown; mediaType?: string; nodeId?: string; };

export type PrismaFieldContract = { id: string; identity: boolean; model: string; name: string; nullable: boolean; storageField: string; type: string; unique: boolean; unit: string; };

export type PrismaModelContract = { fields: PrismaFieldContract[]; id: string; name: string; storageEntity: string; unit: string; };

export type PrismaModelsSelectorResult = unknown;

export type PrismaRelationContract = { cardinality: string; from: string; id: string; name: string; required?: boolean; storageRelation: string; to: string; unit: string; };

export type PrismaRelationsSelectorResult = unknown;

export type PrismaSyntaxRenderInput = { asset: AssetContract; models: PrismaModelContract[]; relations: PrismaRelationContract[]; unit: SyntaxUnitContract; };

export type PrismaSyntaxRenderSelectorParams = { asset: string; syntaxUnit: string; };

export type PrismaSyntaxUnitSelectorParams = { unit: string; };

export type SyntaxUnitContract = { id?: string; kind?: string; metadata?: unknown; nodeId?: string; role?: string; subject?: string; };
