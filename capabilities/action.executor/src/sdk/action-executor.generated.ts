import * as ModelTypes from "./action-executor-types.generated";

export type ActionExecutorAdapter = { execute: (input: { root: string; environment?: string; graph: unknown; runtime?: unknown; }) => Promise<ModelTypes.ActionOutput[]>; sync: (input: { root: string; graph: unknown; runtime?: unknown; preview?: boolean; forceBreaking?: boolean; yes?: boolean; target?: string; }) => Promise<ModelTypes.SyncExecutorOutput>; };

export type ActionExecutorAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof ActionExecutorAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const actionExecutorAdapterContract: ActionExecutorAdapterContract = { capability: "action.executor", methods: [{ name: "execute", guards: [] }, { name: "sync", guards: [] }] };

export function implementActionExecutorAdapter(adapter: ActionExecutorAdapter): ActionExecutorAdapter {
	return adapter;
}

export type ActionExecutor = ActionExecutorAdapter;
