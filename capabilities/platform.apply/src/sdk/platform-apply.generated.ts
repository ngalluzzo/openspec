import * as ModelTypes from "./platform-apply-types.generated";

export type PlatformApplyAdapter = { apply: (input: ModelTypes.PlatformApplyInput) => Promise<ModelTypes.PlatformApplyOutput>; };

export type PlatformApplyAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof PlatformApplyAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const platformApplyAdapterContract: PlatformApplyAdapterContract = { capability: "platform.apply", methods: [{ name: "apply", guards: [] }] };

export function implementPlatformApplyAdapter(adapter: PlatformApplyAdapter): PlatformApplyAdapter {
	return adapter;
}

export type PlatformApply = PlatformApplyAdapter;
