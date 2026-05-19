import { createExpressoRuntime } from "@gooi/expresso";
import type { GraphRuntime } from "@openspec/compiler";
import { implementFlowExecutorAdapter } from "@openspec/flow-executor-capability";
import type {
	ExecuteFlowResult,
	FlowDiagnostic,
} from "@openspec/flow-executor-capability/types";
import type {
	ProcedureInvocationContract,
	ProcedureLinkInput,
} from "@openspec/procedure-patterns";

export type MethodDispatcher = (input: unknown) => Promise<unknown>;

export type FlowExecutorOptions = {
	runtime: GraphRuntime;
	methods:
		| ReadonlyMap<string, MethodDispatcher>
		| Record<string, MethodDispatcher>;
};

type FlowState = {
	flow: {
		inputs: unknown;
	};
	steps: Record<string, { input?: unknown; output?: unknown }>;
};

export function createFlowExecutorAdapter(options: FlowExecutorOptions) {
	const methods =
		options.methods instanceof Map
			? options.methods
			: new Map(Object.entries(options.methods));
	const runtime = createExpressoRuntime();

	return implementFlowExecutorAdapter({
		async execute(input): Promise<ExecuteFlowResult> {
			const flowId = localFlowId(input.flow);
			const invocations = options.runtime.hasSelector(
				"procedure.invocationsForFlow",
			)
				? selectProcedureInvocationsForFlow(options.runtime, { flow: flowId })
				: [];
			const order = orderInvocations(invocations, options.runtime, flowId);
			const state: FlowState = {
				flow: { inputs: input.inputs ?? {} },
				steps: {},
			};
			const diagnostics: FlowDiagnostic[] = [];

			for (const invocation of order) {
				const dispatch = methods.get(invocation.method);
				if (!dispatch) {
					diagnostics.push({
						severity: "error",
						code: "flow.executor.method.missing",
						message: `No adapter registered for method '${invocation.method}'.`,
						details: {
							invocation: invocation.id,
							method: invocation.method,
						} as unknown,
					});
					continue;
				}

				const mappedInput = evaluateTemplate(
					invocation.inputMapping ?? {},
					state,
					runtime,
				);
				const output = await dispatch(mappedInput);
				state.steps[invocation.activity] = {
					input: mappedInput,
					output:
						invocation.outputMapping != null
							? evaluateTemplate(
									invocation.outputMapping,
									{ ...state, output },
									runtime,
								)
							: output,
				};
			}

			return {
				outputs: evaluateTemplate(
					flowOutputMapping(options.runtime, flowId) ?? {},
					state,
					runtime,
				),
				diagnostics,
			};
		},
	});
}

function orderInvocations(
	invocations: ProcedureInvocationContract[],
	runtime: GraphRuntime,
	flowId: string,
): ProcedureInvocationContract[] {
	const flow = runtime.node(`flow.flow:${flowId}`);
	const attrs = flow?.attributes as
		| { links?: ProcedureLinkInput[] }
		| undefined;
	const links = attrs?.links ?? [];
	const before = new Map<string, Set<string>>();
	for (const link of links) {
		const from = activityId(link.from);
		const to = activityId(link.to);
		if (!from || !to) continue;
		const dependencies = before.get(to) ?? new Set<string>();
		dependencies.add(from);
		before.set(to, dependencies);
	}

	const remaining = new Map(invocations.map((item) => [item.activity, item]));
	const ordered: ProcedureInvocationContract[] = [];
	while (remaining.size > 0) {
		const ready = [...remaining.values()].filter((item) =>
			[...(before.get(item.activity) ?? [])].every(
				(dependency) => !remaining.has(dependency),
			),
		);
		if (ready.length === 0) return [...ordered, ...remaining.values()];
		ready.sort((left, right) => left.activity.localeCompare(right.activity));
		for (const item of ready) {
			ordered.push(item);
			remaining.delete(item.activity);
		}
	}
	return ordered;
}

function flowOutputMapping(
	runtime: GraphRuntime,
	flowId: string,
): unknown | undefined {
	const flow = runtime.node(`flow.flow:${flowId}`);
	const attrs = flow?.attributes as
		| { metadata?: { outputMapping?: unknown } }
		| undefined;
	return attrs?.metadata?.outputMapping;
}

function selectProcedureInvocationsForFlow(
	runtime: GraphRuntime,
	params: { flow: string },
): ProcedureInvocationContract[] {
	if (!runtime.hasSelector("procedure.invocationsForFlow")) return [];
	return runtime.select(
		"procedure.invocationsForFlow",
		params,
	) as ProcedureInvocationContract[];
}

function evaluateTemplate(
	template: unknown,
	context: unknown,
	runtime: ReturnType<typeof createExpressoRuntime>,
): unknown {
	if (Array.isArray(template)) {
		return template.map((item) => evaluateTemplate(item, context, runtime));
	}
	const record = objectOrUndefined(template);
	if (!record) return template;
	if (isExpression(record)) {
		return runtime.evaluateSync({ expression: record, context });
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [
			key,
			evaluateTemplate(value, context, runtime),
		]),
	);
}

function isExpression(record: Record<string, unknown>): boolean {
	if ("$expr" in record) return true;
	const keys = Object.keys(record);
	if (keys.length !== 1) return false;
	return keys[0] === "var" || keys[0] === "if" || keys[0] === "cat";
}

function localFlowId(flow: string): string {
	const prefix = "flow.flow:";
	return flow.startsWith(prefix) ? flow.slice(prefix.length) : flow;
}

function activityId(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const prefix = "flow.activity:";
	const withoutPrefix = value.startsWith(prefix)
		? value.slice(prefix.length)
		: value;
	const dot = withoutPrefix.lastIndexOf(".");
	return dot >= 0 ? withoutPrefix.slice(dot + 1) : withoutPrefix;
}

function objectOrUndefined(
	value: unknown,
): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}
