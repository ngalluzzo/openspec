import type { PluginRegistry } from "./registry";
import type { Plugin, PluginLoadOptions } from "./types";

/**
 * Lists plugins.
 *
 * @returns The result produced by `listPlugins`.
 *
 * @example
 * listPlugins();
 */

export async function listPlugins(pluginRegistry: PluginRegistry) {
	const plugins = pluginRegistry.list();

	console.log(`\n📦 Loaded Plugins (${plugins.length}):\n`);

	if (plugins.length === 0) {
		console.log("  No plugins loaded\n");
		return;
	}

	for (const plugin of plugins) {
		console.log(`  • ${plugin.name}`);
		if (plugin.description) {
			console.log(`    ${plugin.description}`);
		}
		console.log(`    Version: ${plugin.version}`);
		console.log(`    Operators: ${plugin.operators.join(", ")}`);
		console.log();
	}
}

/**
 * Executes `showPluginInfo` with the provided inputs.
 *
 * @param name - The `name` argument value.
 *
 * @returns The result produced by `showPluginInfo`.
 *
 * @example
 * showPluginInfo(name);
 */

export async function showPluginInfo(
	pluginRegistry: PluginRegistry,
	name: string,
) {
	const plugin = pluginRegistry.get(name);

	if (!plugin) {
		console.error(`\n❌ Plugin "${name}" not found\n`);
		process.exit(1);
	}

	console.log(`\n${"=".repeat(60)}`);
	console.log(`Plugin: ${plugin.name}`);
	console.log(`${"=".repeat(60)}\n`);

	console.log(`Version:      ${plugin.version}`);
	console.log(`Description:  ${plugin.description || "No description"}`);
	console.log(`Operators:    ${plugin.operators.length}`);
	console.log(`Operator IDs: ${plugin.operators.join(", ")}`);
	console.log();
}

/**
 * Lists namespaces.
 *
 * @returns The result produced by `listNamespaces`.
 *
 * @example
 * listNamespaces();
 */

export async function listNamespaces(pluginRegistry: PluginRegistry) {
	const namespaces = pluginRegistry.getNamespaces();

	console.log(`\n📂 Namespaces (${namespaces.length}):\n`);

	if (namespaces.length === 0) {
		console.log("  No namespaces registered\n");
		return;
	}

	for (const namespace of namespaces) {
		const ops = pluginRegistry.getOperatorsInNamespace(namespace);
		console.log(`  • ${namespace} (${ops.length} operators)`);
		console.log(`    ${ops.join(", ")}`);
		console.log();
	}
}

/**
 * Lists operators.
 *
 * @returns The result produced by `listOperators`.
 *
 * @example
 * listOperators();
 */

export async function listOperators(pluginRegistry: PluginRegistry) {
	const namespaces = pluginRegistry.getNamespaces();

	console.log(`\n🔧 Operators by Namespace:\n`);

	if (namespaces.length === 0) {
		console.log("  No operators registered\n");
		return;
	}

	let total = 0;
	for (const namespace of namespaces) {
		const ops = pluginRegistry.getOperatorsInNamespace(namespace);
		total += ops.length;
		console.log(`  ${namespace}:\n    ${ops.join(", ")}\n`);
	}

	console.log(`Total: ${total} operators\n`);
}

/**
 * Loads plugin.
 *
 * @param plugin - The `plugin` argument value.
 * @param options - Optional behavior and execution settings.
 *
 * @returns The result produced by `loadPlugin`.
 *
 * @example
 * loadPlugin(plugin, options);
 */

export async function loadPlugin(
	pluginRegistry: PluginRegistry,
	plugin: Plugin,
	options: PluginLoadOptions = {},
) {
	console.log(`\n📦 Loading plugin: ${plugin.name}\n`);

	const result = await pluginRegistry.load(plugin, options);

	if (result.success) {
		console.log(`✅ Plugin "${plugin.name}" loaded successfully\n`);
		if (result.warnings && result.warnings.length > 0) {
			console.log("⚠️  Warnings:");
			for (const warning of result.warnings) {
				console.log(`  • ${warning}`);
			}
			console.log();
		}
	} else {
		console.error(`❌ Failed to load plugin "${plugin.name}"\n`);
		if (result.errors && result.errors.length > 0) {
			console.error("Errors:");
			for (const error of result.errors) {
				console.error(`  • ${error}`);
			}
			console.error();
		}
		process.exit(1);
	}
}

/**
 * Executes `unloadPlugin` with the provided inputs.
 *
 * @param name - The `name` argument value.
 *
 * @returns The result produced by `unloadPlugin`.
 *
 * @example
 * unloadPlugin(name);
 */

export async function unloadPlugin(
	pluginRegistry: PluginRegistry,
	name: string,
) {
	console.log(`\n📦 Unloading plugin: ${name}\n`);

	const success = await pluginRegistry.unload(name);

	if (success) {
		console.log(`✅ Plugin "${name}" unloaded successfully\n`);
	} else {
		console.error(`❌ Failed to unload plugin "${name}" (not found)\n`);
		process.exit(1);
	}
}

/**
 * Executes `reloadPlugin` with the provided inputs.
 *
 * @param name - The `name` argument value.
 *
 * @returns The result produced by `reloadPlugin`.
 *
 * @example
 * reloadPlugin(name);
 */

export async function reloadPlugin(
	pluginRegistry: PluginRegistry,
	name: string,
) {
	console.log(`\n🔄 Reloading plugin: ${name}\n`);

	const result = await pluginRegistry.reload(name);

	if (result.success) {
		console.log(`✅ Plugin "${name}" reloaded successfully\n`);
		if (result.warnings && result.warnings.length > 0) {
			console.log("⚠️  Warnings:");
			for (const warning of result.warnings) {
				console.log(`  • ${warning}`);
			}
			console.log();
		}
	} else {
		console.error(`❌ Failed to reload plugin "${name}"\n`);
		if (result.errors && result.errors.length > 0) {
			console.error("Errors:");
			for (const error of result.errors) {
				console.error(`  • ${error}`);
			}
			console.error();
		}
		process.exit(1);
	}
}

/**
 * Executes `showPluginStats` with the provided inputs.
 *
 * @returns The result produced by `showPluginStats`.
 *
 * @example
 * showPluginStats();
 */

export async function showPluginStats(pluginRegistry: PluginRegistry) {
	const stats = pluginRegistry.getStats();

	console.log("\n📊 Plugin Statistics\n");
	console.log(`Total Plugins:    ${stats.totalPlugins}`);
	console.log(`Total Namespaces: ${stats.totalNamespaces}`);
	console.log(`Total Operators:  ${stats.totalOperators}`);
	console.log();

	if (Object.keys(stats.pluginsByNamespace).length > 0) {
		console.log("Operators by Namespace:");
		for (const [namespace, count] of Object.entries(
			stats.pluginsByNamespace,
		).sort((a, b) => b[1] - a[1])) {
			console.log(`  ${namespace.padEnd(25)} ${count}`);
		}
		console.log();
	}
}

/**
 * Executes `clearPlugins` with the provided inputs.
 *
 * @returns The result produced by `clearPlugins`.
 *
 * @example
 * clearPlugins();
 */

export async function clearPlugins(pluginRegistry: PluginRegistry) {
	console.log("\n🧹 Clearing all plugins...\n");

	pluginRegistry.clear();

	console.log("✅ All plugins cleared\n");
}
