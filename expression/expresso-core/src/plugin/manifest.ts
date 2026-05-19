import type { OperatorCategory } from "../types/metadata";
import type { Plugin } from "./types";

/**
 * PluginManifestEntry contract.
 */
export type PluginManifestEntry = {
	readonly name: string;
	readonly category: OperatorCategory;
};

export type StandardPluginLoader = (
	entry: PluginManifestEntry,
) => Promise<Plugin | undefined>;

export let STANDARD_PLUGINS: readonly PluginManifestEntry[] = [];

let loadPlugin: StandardPluginLoader | undefined;

const pluginCache = new Map<string, Plugin>();

export function configureStandardPlugins(input: {
	readonly plugins: readonly PluginManifestEntry[];
	readonly loadPlugin: StandardPluginLoader;
}): void {
	STANDARD_PLUGINS = input.plugins;
	loadPlugin = input.loadPlugin;
	pluginCache.clear();
}

export function clearStandardPluginConfiguration(): void {
	STANDARD_PLUGINS = [];
	loadPlugin = undefined;
	pluginCache.clear();
}

/**
 * Loads standard plugin.
 *
 * @param nameOrEntry - The `nameOrEntry` argument value.
 *
 * @returns The result produced by `loadStandardPlugin`.
 *
 * @example
 * loadStandardPlugin(nameOrEntry);
 */

export async function loadStandardPlugin(
	nameOrEntry: string | PluginManifestEntry,
): Promise<Plugin | undefined> {
	if (!loadPlugin) {
		return undefined;
	}

	const entry =
		typeof nameOrEntry === "string"
			? STANDARD_PLUGINS.find((p) => p.name === nameOrEntry)
			: nameOrEntry;
	if (!entry) return undefined;

	const cached = pluginCache.get(entry.name);
	if (cached) return cached;

	const plugin = await loadPlugin(entry);
	if (!plugin) return undefined;

	pluginCache.set(entry.name, plugin);
	return plugin;
}

export function getStandardPluginEntries(): readonly PluginManifestEntry[] {
	return STANDARD_PLUGINS;
}
