import type { Plugin } from "@gooi/expresso-core";

import { registerExists, registerLog, registerNotExists } from "./operators";

const miscPlugin: Plugin = {
	name: "@std/misc",
	version: "1.0.0",
	description: "Miscellaneous operators for Expresso",
	category: "misc",
	operators: ["log", "exists", "!exists"],
	dependencies: ["@std/data-access"],

	register({ operatorRegistry }) {
		registerLog(operatorRegistry);
		registerExists(operatorRegistry);
		registerNotExists(operatorRegistry);
	},

	unregister() {
		// Unregister all operators when plugin is unloaded
		// This requires the registry to support unregistration
	},
};

export default miscPlugin;
