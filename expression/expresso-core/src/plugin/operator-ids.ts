import type { Plugin } from "./types";

export const getPluginRuntimeOperatorIds = (
	plugin: Plugin,
): readonly string[] => {
	const boundLogicalOperatorIds = new Set(
		(plugin.operatorBindings ?? []).map((binding) => binding.logicalId),
	);
	const runtimeOperatorIds = new Set<string>(
		plugin.operators.filter(
			(operatorId) => !boundLogicalOperatorIds.has(operatorId),
		),
	);
	for (const binding of plugin.operatorBindings ?? []) {
		runtimeOperatorIds.add(binding.runtimeId);
	}

	return Array.from(runtimeOperatorIds);
};

export const pluginDeclaresOperatorId = (
	plugin: Plugin,
	operatorId: string,
): boolean => {
	if (plugin.operators.includes(operatorId)) {
		return true;
	}

	return (
		plugin.operatorBindings?.some(
			(binding) => binding.runtimeId === operatorId,
		) ?? false
	);
};
