import * as ModelTypes from "./external-source-types.generated";

export type ExternalSourceAdapter = { read: (input: ModelTypes.ExternalSourceInput) => Promise<ModelTypes.ExternalSourceOutput>; };

export type ExternalSourceAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ExternalSourceAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const externalSourceAdapterContract: ExternalSourceAdapterContract = { capability: "external.source", methods: [{ name: "read", guards: [] }] };

export function implementExternalSourceAdapter(adapter: ExternalSourceAdapter): ExternalSourceAdapter {
	return adapter;
}

export type ExternalSource = ExternalSourceAdapter;
