import type { OperatorRegistry } from "../operators/registry";
import {
	createOperatorRegistry,
	getDefaultOperatorRegistry,
} from "../operators/registry";
import {
	getPluginRuntimeOperatorIds,
	pluginDeclaresOperatorId,
} from "./operator-ids";
import type {
	CreatePluginOptions,
	Plugin,
	PluginLoadOptions,
	PluginLoadResult,
	PluginRegistryState,
} from "./types";

export function createPlugin(options: CreatePluginOptions): Plugin {
	return {
		name: options.name,
		version: options.version,
		...(options.description !== undefined && {
			description: options.description,
		}),
		category: options.category,
		operators: options.operators,
		...(options.operatorBindings !== undefined && {
			operatorBindings: options.operatorBindings,
		}),
		...(options.dependencies !== undefined && {
			dependencies: options.dependencies,
		}),
		register: options.register,
		...(options.unregister !== undefined && {
			unregister: options.unregister,
		}),
	};
}

export class PluginRegistry {
	constructor(private readonly operatorRegistry: OperatorRegistry) {}

	private plugins = new Map<string, Plugin>();
	private namespaces = new Map<string, Set<string>>();
	private loadedAt = new Date();

	private getNamespaceOps(namespace: string): Set<string> | undefined {
		if (!this.namespaces.has(namespace)) {
			this.namespaces.set(namespace, new Set());
		}

		return this.namespaces.get(namespace);
	}

	private addPluginToNamespace(plugin: Plugin): string[] {
		const namespace = plugin.name.split("/")[0] as string;
		const namespaceOps = this.getNamespaceOps(namespace);
		if (!namespaceOps) {
			throw new Error(`Failed to create namespace "${namespace}"`);
		}

		const warnings: string[] = [];
		for (const runtimeOperatorId of getPluginRuntimeOperatorIds(plugin)) {
			if (this.operatorRegistry.has(runtimeOperatorId)) {
				warnings.push(
					`Operator "${runtimeOperatorId}" is already registered. Will be overridden.`,
				);
			}
		}

		for (const operatorId of plugin.operators) {
			namespaceOps.add(operatorId);
		}

		return warnings;
	}

	private removePluginFromNamespace(plugin: Plugin): void {
		const namespace = plugin.name.split("/")[0] as string;
		const namespaceOps = this.namespaces.get(namespace);
		if (!namespaceOps) {
			return;
		}

		for (const operatorId of plugin.operators) {
			namespaceOps.delete(operatorId);
		}

		if (namespaceOps.size === 0) {
			this.namespaces.delete(namespace);
		}
	}

	getState(): PluginRegistryState {
		return {
			plugins: new Map(this.plugins),
			namespaces: new Map(this.namespaces),
			loadedAt: new Date(this.loadedAt),
		};
	}

	list(): Plugin[] {
		return Array.from(this.plugins.values());
	}

	get(name: string): Plugin | undefined {
		return this.plugins.get(name);
	}

	has(name: string): boolean {
		return this.plugins.has(name);
	}

	declaresOperator(operatorId: string): boolean {
		return Array.from(this.plugins.values()).some((plugin) =>
			pluginDeclaresOperatorId(plugin, operatorId),
		);
	}

	getByDeclaredOperator(operatorId: string): Plugin | undefined {
		for (const plugin of this.plugins.values()) {
			if (pluginDeclaresOperatorId(plugin, operatorId)) {
				return plugin;
			}
		}
		return undefined;
	}

	hasRegisteredOperator(operatorId: string): boolean {
		if (!this.operatorRegistry.has(operatorId)) {
			return false;
		}

		return Array.from(this.plugins.values()).some((plugin) =>
			getPluginRuntimeOperatorIds(plugin).includes(operatorId),
		);
	}

	getByRegisteredOperator(operatorId: string): Plugin | undefined {
		if (!this.operatorRegistry.has(operatorId)) {
			return undefined;
		}

		for (const plugin of this.plugins.values()) {
			if (getPluginRuntimeOperatorIds(plugin).includes(operatorId)) {
				return plugin;
			}
		}

		return undefined;
	}

	getByNamespace(namespace: string): Plugin[] {
		return Array.from(this.plugins.values()).filter(
			(plugin) => plugin.name.split("/")[0] === namespace,
		);
	}

	getNamespaces(): string[] {
		return Array.from(this.namespaces.keys());
	}

	getOperatorsInNamespace(namespace: string): string[] {
		const ops = this.namespaces.get(namespace);
		return ops ? Array.from(ops) : [];
	}

	private getLoadOrder(plugins: Plugin[]): Plugin[] {
		const pluginMap = new Map(plugins.map((p) => [p.name, p]));
		const order: Plugin[] = [];
		const visited = new Set<string>();
		const visiting = new Set<string>();

		function visit(pluginName: string) {
			if (visited.has(pluginName)) return;
			if (visiting.has(pluginName)) {
				throw new Error(`Circular dependency detected: ${pluginName}`);
			}

			visiting.add(pluginName);
			const plugin = pluginMap.get(pluginName);
			if (plugin?.dependencies) {
				for (const dep of plugin.dependencies) {
					visit(dep);
				}
			}

			visiting.delete(pluginName);
			visited.add(pluginName);
			if (plugin) {
				order.push(plugin);
			}
		}

		for (const p of plugins) {
			visit(p.name);
		}
		return order;
	}

	async load(
		plugin: Plugin,
		options: PluginLoadOptions = {},
	): Promise<PluginLoadResult> {
		const { autoRegister = true } = options;

		const errors: string[] = [];
		const warnings: string[] = [];

		if (this.plugins.has(plugin.name)) {
			errors.push(`Plugin "${plugin.name}" is already loaded`);
			return {
				success: false,
				plugin,
				errors,
			};
		}

		if (plugin.dependencies) {
			const loadErrors: string[] = [];
			for (const depName of plugin.dependencies) {
				if (!this.has(depName)) {
					loadErrors.push(`Missing loaded dependency plugin: ${depName}`);
				}
			}

			if (loadErrors.length > 0) {
				errors.push(...loadErrors);
				return {
					success: false,
					plugin,
					errors,
				};
			}
		}

		try {
			warnings.push(...this.addPluginToNamespace(plugin));
		} catch (error) {
			errors.push(String(error));
			return {
				success: false,
				plugin,
				errors,
			};
		}

		if (autoRegister) {
			try {
				await plugin.register({
					operatorRegistry: this.operatorRegistry,
				});
			} catch (error) {
				errors.push(`Failed to register plugin "${plugin.name}": ${error}`);
				this.removePluginFromNamespace(plugin);
				return {
					success: false,
					plugin,
					errors,
				};
			}
		}

		this.plugins.set(plugin.name, plugin);
		this.loadedAt = new Date();

		return {
			success: true,
			plugin,
			warnings,
		};
	}

	loadSynchronously(
		plugin: Plugin,
		options: PluginLoadOptions = {},
	): PluginLoadResult {
		const { autoRegister = true } = options;

		const errors: string[] = [];
		const warnings: string[] = [];

		if (this.plugins.has(plugin.name)) {
			errors.push(`Plugin "${plugin.name}" is already loaded`);
			return {
				success: false,
				plugin,
				errors,
			};
		}

		for (const depName of plugin.dependencies ?? []) {
			if (!this.has(depName)) {
				errors.push(`Missing loaded dependency plugin: ${depName}`);
			}
		}

		if (errors.length > 0) {
			return {
				success: false,
				plugin,
				errors,
			};
		}

		try {
			warnings.push(...this.addPluginToNamespace(plugin));
		} catch (error) {
			errors.push(String(error));
			return {
				success: false,
				plugin,
				errors,
			};
		}

		if (autoRegister) {
			try {
				const result = plugin.register({
					operatorRegistry: this.operatorRegistry,
				});
				if (result instanceof Promise) {
					errors.push(
						`Plugin "${plugin.name}" requires async registration and cannot be loaded synchronously.`,
					);
					this.removePluginFromNamespace(plugin);
					return {
						success: false,
						plugin,
						errors,
					};
				}
			} catch (error) {
				errors.push(`Failed to register plugin "${plugin.name}": ${error}`);
				this.removePluginFromNamespace(plugin);
				return {
					success: false,
					plugin,
					errors,
				};
			}
		}

		this.plugins.set(plugin.name, plugin);
		this.loadedAt = new Date();

		return {
			success: true,
			plugin,
			warnings,
		};
	}

	async unload(pluginName: string): Promise<boolean> {
		const plugin = this.plugins.get(pluginName);
		if (!plugin) {
			return false;
		}

		if (plugin.unregister) {
			try {
				await plugin.unregister?.({
					operatorRegistry: this.operatorRegistry,
				});
			} catch (error) {
				console.error("Error unloading plugin", pluginName, error);
			}
		}

		this.removePluginFromNamespace(plugin);

		this.plugins.delete(pluginName);
		return true;
	}

	async reload(pluginName: string): Promise<PluginLoadResult> {
		const plugin = this.plugins.get(pluginName);
		if (!plugin) {
			return {
				success: false,
				plugin: {} as Plugin,
				errors: [`Plugin "${pluginName}" not found`],
			};
		}

		await this.unload(pluginName);

		return await this.load(plugin);
	}

	async loadMultiple(plugins: Plugin[]): Promise<PluginLoadResult[]> {
		const ordered = this.getLoadOrder(plugins);
		const results: PluginLoadResult[] = [];

		for (const plugin of ordered) {
			const result = await this.load(plugin, { autoRegister: true });
			results.push(result);
		}

		return results;
	}

	clear(): void {
		const pluginNames = Array.from(this.plugins.keys());
		for (const name of pluginNames) {
			const plugin = this.plugins.get(name);
			if (plugin?.unregister) {
				plugin.unregister?.({
					operatorRegistry: this.operatorRegistry,
				});
			}
		}

		this.plugins.clear();
		this.namespaces.clear();
		this.loadedAt = new Date();
	}

	getStats() {
		const totalPlugins = this.plugins.size;
		const totalNamespaces = this.namespaces.size;
		const totalOperators = Array.from(this.namespaces.values()).reduce(
			(sum, ops) => sum + ops.size,
			0,
		);

		const pluginsByNamespace = new Map<string, number>();
		for (const [namespace, ops] of this.namespaces) {
			const count = pluginsByNamespace.get(namespace) || 0;
			pluginsByNamespace.set(namespace, count + ops.size);
		}

		return {
			totalPlugins,
			totalNamespaces,
			totalOperators,
			pluginsByNamespace: Object.fromEntries(pluginsByNamespace),
		};
	}
}

export const createPluginRegistry = (args: {
	operatorRegistry: OperatorRegistry;
}): PluginRegistry => new PluginRegistry(args.operatorRegistry);

export const pluginRegistry = createPluginRegistry({
	operatorRegistry: getDefaultOperatorRegistry?.()
		? getDefaultOperatorRegistry()
		: createOperatorRegistry(),
});
