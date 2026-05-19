import type { OperatorRegistry } from "../../operators/registry";
import { pluginDeclaresOperatorId } from "../../plugin/operator-ids";
import { getDefaultOperatorRegistry } from "../../operators/registry";
import type { PluginRegistry } from "../../plugin/registry";
import {
	getStandardPluginEntries,
	loadStandardPlugin,
} from "../../plugin/manifest";
import { pluginRegistry as globalPluginRegistry } from "../../plugin/registry";
import type { Plugin } from "../../plugin/types";
import type { OperatorCategory } from "../../types/metadata";

type InitOptions = {
	readonly operatorRegistry?: OperatorRegistry;
	readonly pluginRegistry?: PluginRegistry;
	readonly registerPlugins?: boolean;
	readonly plugins?: readonly Plugin[];
	readonly categories?: readonly OperatorCategory[];
	readonly operators?: readonly string[];
};

type ResolvedInitOptions = {
	readonly operatorRegistry: OperatorRegistry;
	readonly pluginRegistry: PluginRegistry;
	readonly registerPlugins: boolean;
	readonly plugins: readonly Plugin[];
	readonly categories?: readonly OperatorCategory[];
	readonly operators?: readonly string[];
};

type RegisterStandardOperatorsOptions = {
	readonly pluginRegistry: PluginRegistry;
	readonly plugins: readonly Plugin[];
};

type ClearStandardOperatorsOptions = {
	readonly operatorRegistry?: OperatorRegistry;
	readonly pluginRegistry?: PluginRegistry;
};

let initSequence: Promise<void> = Promise.resolve();

async function withInitLock<T>(fn: () => Promise<T>): Promise<T> {
	let release: (() => void) | undefined;
	const previous = initSequence;

	initSequence = new Promise<void>((resolve) => {
		release = resolve;
	});

	await previous;
	try {
		return await fn();
	} finally {
		release?.();
	}
}

export async function registerStandardOperators(
	options?: RegisterStandardOperatorsOptions,
): Promise<void> {
	const resolved = await resolveStandardPlugins(options?.plugins);
	await withInitLock(() =>
		registerPlugins({
			pluginRegistry: globalPluginRegistry,
			plugins: resolved,
		}),
	);
}

export function clearStandardOperators(
	options: ClearStandardOperatorsOptions = {},
): void {
	const resolvedOperatorRegistry =
		options.operatorRegistry ?? getDefaultOperatorRegistry();
	const resolvedPluginRegistry = options.pluginRegistry ?? globalPluginRegistry;

	resolvedOperatorRegistry.clear();
	resolvedPluginRegistry.clear();
}

async function resolveStandardPlugins(
	plugins?: readonly Plugin[],
): Promise<Plugin[]> {
	if (plugins !== undefined) {
		return [...plugins];
	}

	const resolved = await Promise.all(
		getStandardPluginEntries().map((entry) => loadStandardPlugin(entry)),
	);
	return resolved.filter((plugin): plugin is Plugin => plugin !== undefined);
}

function resolveInitOptions(
	options: InitOptions | undefined,
): ResolvedInitOptions {
	return {
		operatorRegistry: options?.operatorRegistry ?? getDefaultOperatorRegistry(),
		pluginRegistry: options?.pluginRegistry ?? globalPluginRegistry,
		registerPlugins: options?.registerPlugins !== false,
		plugins: options?.plugins ?? [],
		categories: options?.categories,
		operators: options?.operators,
	};
}

export async function init(options: InitOptions): Promise<void> {
	const resolvedOptions = resolveInitOptions(options);
	const resolvedPlugins = await resolveStandardPlugins(
		resolvedOptions.plugins.length > 0 ? resolvedOptions.plugins : undefined,
	);
	const initContext = {
		...resolvedOptions,
		plugins: resolvedPlugins,
	};

	await withInitLock(async () => {
		clearStandardOperators({
			operatorRegistry: initContext.operatorRegistry,
			pluginRegistry: initContext.pluginRegistry,
		});

		if (initContext.registerPlugins === false) {
			return;
		}

		if (initContext.categories) {
			await registerPlugins({
				pluginRegistry: initContext.pluginRegistry,
				plugins: initContext.plugins.filter((plugin) =>
					initContext.categories?.includes(plugin.category),
				),
			});
			return;
		}

		if (initContext.operators) {
			await registerPlugins({
				pluginRegistry: initContext.pluginRegistry,
				plugins: initContext.plugins.filter((plugin) =>
					initContext.operators?.some((operatorId) =>
						pluginDeclaresOperatorId(plugin, operatorId),
					),
				),
			});
			return;
		}

		await registerPlugins({
			pluginRegistry: initContext.pluginRegistry,
			plugins: initContext.plugins,
		});
	});
}

async function registerPlugins(
	options: RegisterStandardOperatorsOptions,
): Promise<void> {
	const results = await options.pluginRegistry.loadMultiple([
		...options.plugins,
	]);
	const failures = results.filter((result) => !result.success);
	if (failures.length > 0) {
		throw new Error(
			`Failed to load plugins: ${failures.map((failure) => failure.errors?.join(", ")).join("; ")}`,
		);
	}
}
