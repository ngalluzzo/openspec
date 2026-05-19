import type { Plugin } from "@gooi/expresso-core";

import {
	registerCat,
	registerSplit,
	registerSubstr,
	registerToLower,
	registerToUpper,
	registerTrim,
} from "./operators";
import {
	registerContains,
	registerIn,
	registerIsEmpty,
	registerNotContains,
	registerType,
} from "./operators-check";

const stringPlugin: Plugin = {
	name: "@std/string",
	version: "1.0.0",
	description: "Standard string operators for Expresso",
	category: "string",
	operators: [
		"contains",
		"!contains",
		"split",
		"trim",
		"to_lower",
		"to_upper",
		"in",
		"cat",
		"substr",
		"is_empty",
		"type",
	],
	dependencies: ["@std/comparison"],

	register({ operatorRegistry }) {
		registerContains(operatorRegistry);
		registerNotContains(operatorRegistry);
		registerSplit(operatorRegistry);
		registerTrim(operatorRegistry);
		registerToLower(operatorRegistry);
		registerToUpper(operatorRegistry);
		registerIn(operatorRegistry);
		registerCat(operatorRegistry);
		registerSubstr(operatorRegistry);
		registerIsEmpty(operatorRegistry);
		registerType(operatorRegistry);
	},

	unregister() {},
};

export default stringPlugin;
