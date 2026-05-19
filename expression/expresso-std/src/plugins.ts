import type { PluginManifestEntry, Plugin } from "@gooi/expresso-core";
import authPlugin from "./auth/plugin";
import comparisonPlugin from "./comparison/plugin";
import cryptoPlugin from "./crypto/plugin";
import dataAccessPlugin from "./data-access/plugin";
import datePlugin from "./date/plugin";
import logicPlugin from "./logic/plugin";
import miscPlugin from "./misc/plugin";
import numericPlugin from "./numeric/plugin";
import objectPlugin from "./object/plugin";
import openspecPlugin from "./openspec/plugin";
import regexPlugin from "./regex/plugin";
import stringPlugin from "./string/plugin";
import validationPlugin from "./validation/plugin";

export {
	authPlugin,
	comparisonPlugin,
	cryptoPlugin,
	dataAccessPlugin,
	datePlugin,
	logicPlugin,
	miscPlugin,
	numericPlugin,
	objectPlugin,
	openspecPlugin,
	regexPlugin,
	stringPlugin,
	validationPlugin,
};

export const stdPlugins: readonly Plugin[] = [
	authPlugin,
	comparisonPlugin,
	cryptoPlugin,
	dataAccessPlugin,
	datePlugin,
	logicPlugin,
	miscPlugin,
	numericPlugin,
	objectPlugin,
	openspecPlugin,
	regexPlugin,
	stringPlugin,
	validationPlugin,
];

export const STANDARD_PLUGINS: readonly PluginManifestEntry[] = stdPlugins.map(
	(plugin) => ({
		name: plugin.name,
		category: plugin.category,
	}),
);

const standardPluginByName = new Map(
	stdPlugins.map((plugin) => [plugin.name, plugin]),
);

export async function loadStandardPlugin(
	nameOrEntry: string | PluginManifestEntry,
): Promise<Plugin | undefined> {
	const name = typeof nameOrEntry === "string" ? nameOrEntry : nameOrEntry.name;
	return standardPluginByName.get(name);
}
