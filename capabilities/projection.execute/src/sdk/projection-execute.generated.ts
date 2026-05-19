import * as ModelTypes from "./projection-execute-types.generated";

export type ProjectionExecuteAdapter = { project: (input: ModelTypes.ProjectionExecuteInput) => Promise<ModelTypes.ProjectionOutput>; };

export type ProjectionExecuteAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ProjectionExecuteAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const projectionExecuteAdapterContract: ProjectionExecuteAdapterContract = { capability: "projection.execute", methods: [{ name: "project", guards: [] }] };

export function implementProjectionExecuteAdapter(adapter: ProjectionExecuteAdapter): ProjectionExecuteAdapter {
	return adapter;
}

export type ProjectionExecute = ProjectionExecuteAdapter;
