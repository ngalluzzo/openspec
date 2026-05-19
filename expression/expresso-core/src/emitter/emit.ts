import {
	defineExpressionEmitterTarget,
	getExpressionEmitterTargetKey,
} from "./targets";
import type { ExpressionEmitterRegistry } from "./registry";
import type { ExpressionEmitRequest, ExpressionEmitResult } from "./types";

export interface EmitExpressionRequest extends ExpressionEmitRequest {
	readonly registry: ExpressionEmitterRegistry;
}

function freezeResult(result: ExpressionEmitResult): ExpressionEmitResult {
	return Object.freeze({
		emitterId: result.emitterId,
		target: defineExpressionEmitterTarget(result.target),
		strategy: result.strategy,
		source: result.source,
		...(result.imports !== undefined && {
			imports: Object.freeze(
				result.imports.map((entry) =>
					Object.freeze({
						kind: entry.kind,
						from: entry.from,
						names: Object.freeze([...entry.names]),
						...(entry.typeOnly !== undefined && { typeOnly: entry.typeOnly }),
					}),
				),
			),
		}),
		...(result.diagnostics !== undefined && {
			diagnostics: Object.freeze(
				result.diagnostics.map((entry) =>
					Object.freeze({
						code: entry.code,
						severity: entry.severity,
						message: entry.message,
					}),
				),
			),
		}),
		...(result.guarantees !== undefined && {
			guarantees: Object.freeze(
				result.guarantees.map((entry) =>
					Object.freeze({
						code: entry.code,
						message: entry.message,
					}),
				),
			),
		}),
		...(result.losses !== undefined && {
			losses: Object.freeze(
				result.losses.map((entry) =>
					Object.freeze({
						code: entry.code,
						message: entry.message,
					}),
				),
			),
		}),
	});
}

export function emitExpression(
	request: EmitExpressionRequest,
): ExpressionEmitResult {
	const { registry, ...emitRequest } = request;
	const normalizedRequest: ExpressionEmitRequest = Object.freeze({
		target: defineExpressionEmitterTarget(emitRequest.target),
		expression: structuredClone(emitRequest.expression),
		...(emitRequest.bindings !== undefined && {
			bindings: Object.freeze(
				emitRequest.bindings.map((binding) =>
					Object.freeze({
						slot: binding.slot,
						reference: binding.reference,
					}),
				),
			),
		}),
	});

	const emitter = registry.resolve(normalizedRequest);
	if (!emitter) {
		throw new Error(
			`No emitter registered for target "${getExpressionEmitterTargetKey(normalizedRequest.target)}"`,
		);
	}

	return freezeResult(
		emitter.emit({
			...normalizedRequest,
			expression: structuredClone(normalizedRequest.expression),
		}),
	);
}
