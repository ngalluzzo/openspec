import type * as ts from "typescript";
import type { JsonValue, Rule } from "../../../runtime/contracts/types";
import type { TypeScriptNativeEmitterContext } from "../contracts";

export type LowerTypeScriptNativeExpression = (
	rule: Rule | JsonValue,
	context: TypeScriptNativeEmitterContext,
) => ts.Expression;

export type TypeScriptNativeOperatorLowerer = (
	operator: string,
	args: readonly (Rule | JsonValue)[],
	context: TypeScriptNativeEmitterContext,
	lower: LowerTypeScriptNativeExpression,
) => ts.Expression | undefined;
