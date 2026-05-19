import type * as ts from "typescript";
import type { ExpressionEmitterTarget } from "../types";

export interface TypeScriptNativeEmitterContext {
	readonly helperImportSource: string;
	readonly imports: Map<string, Set<string>>;
	readonly rootReference: ts.Expression;
}

export interface CreateTypeScriptNativeEmitterOptions {
	readonly id?: string;
	readonly helperImportSource: string;
	readonly target?: ExpressionEmitterTarget;
}
