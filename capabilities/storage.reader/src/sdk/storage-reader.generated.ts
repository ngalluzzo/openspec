import * as ModelTypes from "./storage-reader-types.generated";

export type StorageReaderAdapter = { read: (input: ModelTypes.ReadQuery) => Promise<ModelTypes.ReadReport>; };

export type StorageReaderAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof StorageReaderAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const storageReaderAdapterContract: StorageReaderAdapterContract = { capability: "storage.runtime", methods: [{ name: "read", guards: [] }] };

export function implementStorageReaderAdapter(adapter: StorageReaderAdapter): StorageReaderAdapter {
	return adapter;
}

export type StorageReader = StorageReaderAdapter;
