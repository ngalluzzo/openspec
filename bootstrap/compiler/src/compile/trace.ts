export type CompileTraceEvent = {
	stage:
		| "document.normalize"
		| "protocol.parse"
		| "protocol.lower"
		| "graph.compose"
		| "passes.run"
		| "protocol.validate";
	documentId?: string;
	protocol?: string;
};

export function traceEvent(event: CompileTraceEvent): CompileTraceEvent {
	return event;
}
