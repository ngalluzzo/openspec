import type { ExpressionEmitterTarget } from "./types";

export const TYPESCRIPT_EXPRESSION_TARGET = Object.freeze({
	language: "typescript",
	surface: "expression",
} satisfies ExpressionEmitterTarget);

export function defineExpressionEmitterTarget(
	target: ExpressionEmitterTarget,
): ExpressionEmitterTarget {
	return Object.freeze({
		language: target.language,
		surface: target.surface,
		...(target.variant !== undefined && { variant: target.variant }),
	});
}

export function getExpressionEmitterTargetKey(
	target: ExpressionEmitterTarget,
): string {
	return `${target.language}::${target.surface}::${target.variant ?? ""}`;
}

export function sameExpressionEmitterTarget(
	left: ExpressionEmitterTarget,
	right: ExpressionEmitterTarget,
): boolean {
	return (
		getExpressionEmitterTargetKey(left) === getExpressionEmitterTargetKey(right)
	);
}
