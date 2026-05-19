import { stdPlugins } from "../../../expresso-std/src/plugins";
import {
	configureStandardPlugins,
	type PluginManifestEntry,
} from "../plugin/manifest";
import type { Plugin } from "../plugin/types";

const standardPlugins = stdPlugins as readonly Plugin[];
const pluginByName = new Map(
	standardPlugins.map((plugin) => [plugin.name, plugin]),
);

const entries: readonly PluginManifestEntry[] = standardPlugins.map(
	(plugin) => ({
		name: plugin.name,
		category: plugin.category,
	}),
);

configureStandardPlugins({
	plugins: entries,
	loadPlugin: async (entry) => pluginByName.get(entry.name),
});
