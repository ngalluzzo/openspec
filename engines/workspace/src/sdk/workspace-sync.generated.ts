import * as ModelTypes from "./workspace-types.generated";

export type WorkspaceSyncAdapter = { run: (input: ModelTypes.SyncRequest) => Promise<ModelTypes.SyncReport>; };

export type WorkspaceSyncAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof WorkspaceSyncAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const workspaceSyncAdapterContract: WorkspaceSyncAdapterContract = { capability: "workspace.sync", methods: [{ name: "run", guards: [] }] };

export function implementWorkspaceSyncAdapter(adapter: WorkspaceSyncAdapter): WorkspaceSyncAdapter {
	return adapter;
}

export type WorkspaceSync = WorkspaceSyncAdapter;
