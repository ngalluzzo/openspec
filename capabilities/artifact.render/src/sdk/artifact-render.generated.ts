import * as ModelTypes from "./artifact-render-types.generated";

export type ArtifactRenderAdapter = { render: (input: ModelTypes.ArtifactRenderInput) => Promise<ModelTypes.ArtifactRenderOutput>; };

export type ArtifactRenderAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ArtifactRenderAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const artifactRenderAdapterContract: ArtifactRenderAdapterContract = { capability: "artifact.render", methods: [{ name: "render", guards: [] }] };

export function implementArtifactRenderAdapter(adapter: ArtifactRenderAdapter): ArtifactRenderAdapter {
	return adapter;
}

export type ArtifactRender = ArtifactRenderAdapter;
