import * as ModelTypes from "./storage-writer-types.generated";

export type StorageWriterAdapter = { write: (input: ModelTypes.WriteBatch) => Promise<ModelTypes.WriteReport>; };

export type StorageWriterAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof StorageWriterAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const storageWriterAdapterContract: StorageWriterAdapterContract = { capability: "storage.writer", methods: [{ name: "write", guards: [] }] };

export function implementStorageWriterAdapter(adapter: StorageWriterAdapter): StorageWriterAdapter {
	return adapter;
}

export type StorageWriter = StorageWriterAdapter;
