import { CoreOperatorIds, type Plugin } from "@gooi/expresso-core";

import {
	registerEq,
	registerNeq,
	registerStrictEq,
	registerStrictNeq,
} from "./operators";

const comparisonPlugin: Plugin = {
	name: "@std/comparison",
	version: "1.0.0",
	description: "Standard comparison operators for Expresso",
	category: "comparisons",
	operators: [CoreOperatorIds.eq, CoreOperatorIds.neq],
	operatorBindings: [
		{
			logicalId: CoreOperatorIds.eq,
			runtimeId: "==",
		},
		{
			logicalId: CoreOperatorIds.neq,
			runtimeId: "!=",
		},
	],
	dependencies: ["@std/numeric"],

	register({ operatorRegistry }) {
		registerEq(operatorRegistry);
		registerStrictEq(operatorRegistry);
		registerNeq(operatorRegistry);
		registerStrictNeq(operatorRegistry);
	},

	unregister() {},
};

export default comparisonPlugin;
