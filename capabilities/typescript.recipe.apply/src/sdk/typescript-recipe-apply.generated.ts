import * as ModelTypes from "./typescript-recipe-apply-types.generated";

export type TypeScriptRecipeApplyAdapter = { apply: (input: ModelTypes.TypeScriptRecipeApplyInput) => Promise<ModelTypes.TypeScriptRecipeApplyResult>; };

export type TypeScriptRecipeApplyAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof TypeScriptRecipeApplyAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const typescriptRecipeApplyAdapterContract: TypeScriptRecipeApplyAdapterContract = { capability: "typescript.recipe.apply", methods: [{ name: "apply", guards: [] }] };

export function implementTypeScriptRecipeApplyAdapter(adapter: TypeScriptRecipeApplyAdapter): TypeScriptRecipeApplyAdapter {
	return adapter;
}

export type TypeScriptRecipeApply = TypeScriptRecipeApplyAdapter;
