import type { Plugin } from "@gooi/expresso-core";

import {
	registerAnd,
	registerDoubleNot,
	registerImplies,
	registerNot,
	registerOr,
	registerXor,
} from "./logic-boolean";
import {
	registerCoalesce,
	registerDefault,
	registerIf,
	registerSwitch,
	registerTernary,
} from "./logic-control-flow";
import {
	registerAssert,
	registerThrow,
	registerTry,
} from "./logic-error-handling";

const logicPlugin: Plugin = {
	name: "@std/logic",
	version: "1.0.0",
	description: "Standard logic operators for Expresso",
	category: "logic",
	operators: [
		"or",
		"and",
		"!",
		"!!",
		"if",
		"switch",
		"ternary",
		"coalesce",
		"default",
		"try",
		"throw",
		"xor",
		"implies",
		"assert",
	],
	dependencies: ["@std/comparison", "@std/data-access"],

	register({ operatorRegistry }) {
		registerOr(operatorRegistry);
		registerAnd(operatorRegistry);
		registerNot(operatorRegistry);
		registerDoubleNot(operatorRegistry);
		registerIf(operatorRegistry);
		registerSwitch(operatorRegistry);
		registerTernary(operatorRegistry);
		registerCoalesce(operatorRegistry);
		registerDefault(operatorRegistry);
		registerTry(operatorRegistry);
		registerThrow(operatorRegistry);
		registerXor(operatorRegistry);
		registerImplies(operatorRegistry);
		registerAssert(operatorRegistry);
	},

	unregister() {
		// Unregister all operators when plugin is unloaded
		// This requires the registry to support unregistration
	},
};

export default logicPlugin;
