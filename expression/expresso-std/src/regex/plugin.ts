import type { Plugin } from "@gooi/expresso-core";

import {
	registerRegexExtract,
	registerRegexMatch,
	registerRegexReplace,
	registerRegexTest,
} from "./operators";

const regexPlugin: Plugin = {
	name: "@std/regex",
	version: "1.0.0",
	description: "Standard regex operators for Expresso",
	category: "regex",
	operators: ["regex_match", "regex_replace", "regex_extract", "regex_test"],

	register({ operatorRegistry }) {
		registerRegexMatch(operatorRegistry);
		registerRegexReplace(operatorRegistry);
		registerRegexExtract(operatorRegistry);
		registerRegexTest(operatorRegistry);
	},

	unregister() {
		// Unregister all operators when plugin is unloaded
		// This requires the registry to support unregistration
	},
};

export default regexPlugin;
