import * as ModelTypes from "./workspace-types.generated";

export type WorkspaceBuildAdapter = { run: (input: ModelTypes.BuildRequest) => Promise<ModelTypes.BuildReport>; };

export type WorkspaceBuildAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof WorkspaceBuildAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const workspaceBuildAdapterContract: WorkspaceBuildAdapterContract = { capability: "workspace.build", methods: [{ name: "run", guards: [] }] };

export function implementWorkspaceBuildAdapter(adapter: WorkspaceBuildAdapter): WorkspaceBuildAdapter {
	return adapter;
}

export type WorkspaceBuild = WorkspaceBuildAdapter;
