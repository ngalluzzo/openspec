import * as ModelTypes from "./prisma-dialect-types.generated";

export type PrismaSyntaxRenderAdapter = { render: (input: ModelTypes.PrismaSyntaxRenderInput) => Promise<ModelTypes.TextFileArtifactRecipe>; };

export type PrismaSyntaxRenderAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof PrismaSyntaxRenderAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const prismaSyntaxRenderAdapterContract: PrismaSyntaxRenderAdapterContract = { capability: "prisma.syntax.render", methods: [{ name: "render", guards: [] }] };

export function implementPrismaSyntaxRenderAdapter(adapter: PrismaSyntaxRenderAdapter): PrismaSyntaxRenderAdapter {
	return adapter;
}

export type PrismaSyntaxRender = PrismaSyntaxRenderAdapter;
