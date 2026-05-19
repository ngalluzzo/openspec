export const WorkspaceHostDispatches = { actionExecutorDefaultExecute: "action.executor.default.execute", compilerCompile: "compiler.compile", materializerLocalFsWrite: "materializer.local-fs.write" };

export type WorkspaceHostDispatchesKey = keyof typeof WorkspaceHostDispatches;

export const WorkspaceHostDispatchesMethodIds = { actionExecutorDefaultExecute: "capability.method:action.executor.execute", compilerCompile: "capability.method:compiler.compile", materializerLocalFsWrite: "capability.method:storage.writer.write" };

export type WorkspaceHostDispatchesDispatcher = (input: unknown) => Promise<unknown>;

export const WorkspaceHostDispatchesFlowId = "workspace.build";

export function createWorkspaceHostDispatchesMethods(dispatchers: Partial<Record<WorkspaceHostDispatchesKey, WorkspaceHostDispatchesDispatcher>>): ReadonlyMap<string, WorkspaceHostDispatchesDispatcher> {
	const methods = new Map<string, WorkspaceHostDispatchesDispatcher>();
	const bindings: Array<[WorkspaceHostDispatchesKey, string]> = [["actionExecutorDefaultExecute", WorkspaceHostDispatchesMethodIds.actionExecutorDefaultExecute], ["compilerCompile", WorkspaceHostDispatchesMethodIds.compilerCompile], ["materializerLocalFsWrite", WorkspaceHostDispatchesMethodIds.materializerLocalFsWrite]];
	for (const [key, methodId] of bindings) { const handler = dispatchers[key]; if (handler) methods.set(methodId, handler); }
	return methods;
}
