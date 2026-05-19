import type { Plugin } from "@gooi/expresso-core";
import {
	verifyPlugin as verifyPluginBase,
	type VerifyPluginOptions,
} from "@gooi/expresso-core/testing/verify-plugin";
import { loadStandardPlugin } from "../plugins";

export async function verifyPlugin(
	plugin: Plugin,
	options: VerifyPluginOptions = {},
) {
	const resolveDependency = async (dependencyName: string) => {
		if (options.resolveDependency) {
			const resolved = await options.resolveDependency(dependencyName);
			if (resolved) {
				return resolved;
			}
		}

		return loadStandardPlugin(dependencyName);
	};

	return verifyPluginBase(plugin, {
		...options,
		resolveDependency,
	});
}
