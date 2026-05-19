import type { Plugin } from "@gooi/expresso-core";

import { registerEntries, registerKeys, registerValues } from "./operators";
import { registerMergeDeep } from "./operators-merge";
import { registerGet, registerHas, registerSet } from "./operators-path";
import { registerOmit, registerPick } from "./operators-select";
import { registerTransform } from "./operators-transform";

const objectPlugin: Plugin = {
	name: "@std/object",
	version: "1.0.0",
	description: "Standard object operators for Expresso",
	category: "object",
	operators: [
		"keys",
		"values",
		"entries",
		"pick",
		"omit",
		"merge_deep",
		"get",
		"set",
		"has",
		"transform",
	],

	register({ operatorRegistry }) {
		registerKeys(operatorRegistry);
		registerValues(operatorRegistry);
		registerEntries(operatorRegistry);
		registerPick(operatorRegistry);
		registerOmit(operatorRegistry);
		registerMergeDeep(operatorRegistry);
		registerGet(operatorRegistry);
		registerSet(operatorRegistry);
		registerHas(operatorRegistry);
		registerTransform(operatorRegistry);
	},

	unregister() {},
};

export default objectPlugin;
