import * as ModelTypes from "./drizzle-dialect-types.generated";

export type DrizzleSyntaxRenderAdapter = { render: (input: ModelTypes.DrizzleSyntaxRenderInput) => Promise<ModelTypes.TextFileArtifactRecipe>; };

export type DrizzleSyntaxRenderAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof DrizzleSyntaxRenderAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const drizzleSyntaxRenderAdapterContract: DrizzleSyntaxRenderAdapterContract = { capability: "drizzle.syntax.render", methods: [{ name: "render", guards: [] }] };

export function implementDrizzleSyntaxRenderAdapter(adapter: DrizzleSyntaxRenderAdapter): DrizzleSyntaxRenderAdapter {
	return adapter;
}

export type DrizzleSyntaxRender = DrizzleSyntaxRenderAdapter;
