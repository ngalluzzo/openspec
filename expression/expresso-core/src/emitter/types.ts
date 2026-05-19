import type { Rule } from "../runtime/contracts/types";

export interface ExpressionEmitterTarget {
	readonly language: string;
	readonly surface: string;
	readonly variant?: string;
}

export interface ExpressionEmitSlotBinding {
	readonly slot: string;
	readonly reference: string;
}

export interface ExpressionEmitterNamedImport {
	readonly kind: "named-import";
	readonly from: string;
	readonly names: readonly string[];
	readonly typeOnly?: boolean;
}

export type ExpressionEmitterImport = ExpressionEmitterNamedImport;

export interface ExpressionEmitDiagnostic {
	readonly code: string;
	readonly severity: "error" | "info" | "warning";
	readonly message: string;
}

export interface ExpressionEmitGuarantee {
	readonly code: string;
	readonly message: string;
}

export interface ExpressionEmitLoss {
	readonly code: string;
	readonly message: string;
}

export interface ExpressionEmitRequest {
	readonly target: ExpressionEmitterTarget;
	readonly expression: Rule;
	readonly bindings?: readonly ExpressionEmitSlotBinding[];
}

export interface ExpressionEmitResult {
	readonly emitterId: string;
	readonly target: ExpressionEmitterTarget;
	readonly strategy: "native" | "runtime-backed";
	readonly source: string;
	readonly imports?: readonly ExpressionEmitterImport[];
	readonly diagnostics?: readonly ExpressionEmitDiagnostic[];
	readonly guarantees?: readonly ExpressionEmitGuarantee[];
	readonly losses?: readonly ExpressionEmitLoss[];
}

export interface ExpressionEmitterSupport {
	readonly supported: boolean;
	readonly reason?: string;
}

export interface ExpressionTargetEmitter {
	readonly id: string;
	readonly targets: readonly ExpressionEmitterTarget[];
	supports?: (
		request: ExpressionEmitRequest,
	) => boolean | ExpressionEmitterSupport;
	emit: (request: ExpressionEmitRequest) => ExpressionEmitResult;
}

export interface ExpressionEmitterRegistrationContext {
	registerEmitter: (emitter: ExpressionTargetEmitter) => void;
}

export interface ExpressionEmitterPlugin {
	readonly id: string;
	readonly version: string;
	readonly description?: string;
	register: (
		context: ExpressionEmitterRegistrationContext,
	) => void | Promise<void>;
}

export interface ExpressionEmitterRegistryState {
	readonly emitters: ReadonlyMap<string, ExpressionTargetEmitter>;
	readonly plugins: ReadonlyMap<string, ExpressionEmitterPlugin>;
}
