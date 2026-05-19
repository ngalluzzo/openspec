import type { Diagnostic } from "../diagnostics/types.ts";
import type { GraphRuntime } from "../graph/runtime.ts";
import type { SemanticEdge, SemanticFacet, SemanticNode } from "../graph/types.ts";

export type DerivationPassContext = {
	readonly runtime: GraphRuntime;
};

export type DerivationPassResult = {
	readonly nodes?: readonly SemanticNode[];
	readonly edges?: readonly SemanticEdge[];
	readonly facets?: readonly SemanticFacet[];
	readonly diagnostics?: readonly Diagnostic[];
};

export type DerivationPass = {
	readonly id: string;
	// Named compilation phase this pass belongs to. The compiler groups passes
	// by phase and runs all passes in one phase before starting the next. Within
	// a phase, passes are topologically sorted by reads/writes. Passes without
	// a phase go into "default", which runs after all explicitly named phases.
	readonly phase?: string;
	// Fact kinds this pass reads and writes. The compiler topologically sorts
	// passes using these declarations: a pass that writes "foo.bar" runs before
	// any pass that reads "foo.bar". A cycle is a compile-time error.
	readonly reads: readonly string[];
	readonly writes: readonly string[];
	readonly derive: (
		context: DerivationPassContext,
	) => DerivationPassResult | Promise<DerivationPassResult>;
};
