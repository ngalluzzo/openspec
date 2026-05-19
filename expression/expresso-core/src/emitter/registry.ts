import {
	defineExpressionEmitterTarget,
	getExpressionEmitterTargetKey,
} from "./targets";
import type {
	ExpressionEmitRequest,
	ExpressionEmitterPlugin,
	ExpressionEmitterRegistryState,
	ExpressionTargetEmitter,
} from "./types";

export class ExpressionEmitterRegistry {
	private readonly emitters = new Map<string, ExpressionTargetEmitter>();
	private readonly plugins = new Map<string, ExpressionEmitterPlugin>();
	private readonly emittersByTarget = new Map<string, string[]>();

	registerEmitter(emitter: ExpressionTargetEmitter): void {
		if (this.emitters.has(emitter.id)) {
			throw new Error(`Emitter "${emitter.id}" is already registered`);
		}

		this.emitters.set(emitter.id, emitter);

		for (const target of emitter.targets) {
			const targetKey = getExpressionEmitterTargetKey(target);
			const emittersForTarget = this.emittersByTarget.get(targetKey) ?? [];
			emittersForTarget.push(emitter.id);
			this.emittersByTarget.set(targetKey, emittersForTarget);
		}
	}

	register(emitter: ExpressionTargetEmitter): void {
		this.registerEmitter(emitter);
	}

	async registerPlugin(plugin: ExpressionEmitterPlugin): Promise<void> {
		if (this.plugins.has(plugin.id)) {
			throw new Error(`Emitter plugin "${plugin.id}" is already registered`);
		}

		await plugin.register({
			registerEmitter: (emitter) => this.registerEmitter(emitter),
		});

		this.plugins.set(plugin.id, plugin);
	}

	get(emitterId: string): ExpressionTargetEmitter | undefined {
		return this.emitters.get(emitterId);
	}

	has(emitterId: string): boolean {
		return this.emitters.has(emitterId);
	}

	list(): readonly ExpressionTargetEmitter[] {
		return Object.freeze([...this.emitters.values()]);
	}

	listForTarget(
		request: ExpressionEmitRequest,
	): readonly ExpressionTargetEmitter[] {
		const targetKey = getExpressionEmitterTargetKey(request.target);
		const emitterIds = this.emittersByTarget.get(targetKey) ?? [];
		return Object.freeze(
			emitterIds
				.map((emitterId) => this.emitters.get(emitterId))
				.filter(
					(emitter): emitter is ExpressionTargetEmitter =>
						emitter !== undefined,
				)
				.filter((emitter) => {
					if (!emitter.supports) {
						return true;
					}

					const support = emitter.supports({
						...request,
						target: defineExpressionEmitterTarget(request.target),
					});
					return typeof support === "boolean" ? support : support.supported;
				}),
		);
	}

	resolve(request: ExpressionEmitRequest): ExpressionTargetEmitter | undefined {
		return this.listForTarget(request)[0];
	}

	getState(): ExpressionEmitterRegistryState {
		return Object.freeze({
			emitters: new Map(this.emitters),
			plugins: new Map(this.plugins),
		});
	}
}
