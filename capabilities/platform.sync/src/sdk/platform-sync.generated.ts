import * as ModelTypes from "./platform-sync-types.generated";

export type PlatformSyncAdapter = { sync: (input: ModelTypes.SyncInput) => Promise<ModelTypes.SyncOutput>; };

export type PlatformSyncAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof PlatformSyncAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const platformSyncAdapterContract: PlatformSyncAdapterContract = { capability: "platform.sync", methods: [{ name: "sync", guards: [] }] };

export function implementPlatformSyncAdapter(adapter: PlatformSyncAdapter): PlatformSyncAdapter {
	return adapter;
}

export type PlatformSync = PlatformSyncAdapter;
