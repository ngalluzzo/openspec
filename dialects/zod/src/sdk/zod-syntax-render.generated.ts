import * as ModelTypes from "./zod-dialect-types.generated";

export type ZodSyntaxRenderAdapter = { render: (input: ModelTypes.ZodSyntaxRenderInput) => Promise<ModelTypes.TextFileArtifactRecipe>; };

export type ZodSyntaxRenderAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ZodSyntaxRenderAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const zodSyntaxRenderAdapterContract: ZodSyntaxRenderAdapterContract = { capability: "zod.syntax.render", methods: [{ name: "render", guards: [] }] };

export function implementZodSyntaxRenderAdapter(adapter: ZodSyntaxRenderAdapter): ZodSyntaxRenderAdapter {
	return adapter;
}

export type ZodSyntaxRender = ZodSyntaxRenderAdapter;
