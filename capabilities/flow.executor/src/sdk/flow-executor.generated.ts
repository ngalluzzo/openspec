import * as ModelTypes from "./flow-executor-types.generated";

export type FlowExecutorAdapter = { execute: (input: ModelTypes.ExecuteFlowRequest) => Promise<ModelTypes.ExecuteFlowResult>; };

export type FlowExecutorAdapterContract = { readonly capability: string; readonly methods: { readonly name: keyof FlowExecutorAdapter & string; readonly guards: { readonly id: string; readonly target?: string; readonly description?: string; readonly assertion?: unknown; readonly failure?: unknown; readonly metadata?: unknown; }[]; }[] };

export const flowExecutorAdapterContract: FlowExecutorAdapterContract = { capability: "flow.executor", methods: [{ name: "execute", guards: [] }] };

export function implementFlowExecutorAdapter(adapter: FlowExecutorAdapter): FlowExecutorAdapter {
	return adapter;
}

export type FlowExecutor = FlowExecutorAdapter;
