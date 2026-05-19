import { CoreOperatorIds, type Plugin } from "@gooi/expresso-core";

import {
	registerAbs,
	registerDivide,
	registerMinus,
	registerModulo,
	registerMultiply,
	registerPlus,
	registerToInteger,
	registerToNumber,
} from "./operators";
import { registerMax, registerMin } from "./operators-aggregation";
import {
	registerBetween,
	registerGreaterEqual,
	registerGreaterThan,
	registerLessEqual,
	registerLessThan,
} from "./operators-comparison";

const numericPlugin: Plugin = {
	name: "@std/numeric",
	version: "1.0.0",
	description: "Standard numeric operators for Expresso",
	category: "numeric",
	operators: [
		CoreOperatorIds.gt,
		CoreOperatorIds.gte,
		CoreOperatorIds.lt,
		CoreOperatorIds.lte,
		"between",
		"min",
		"max",
		"plus",
		"minus",
		"multiply",
		"divide",
		"modulo",
		"abs",
		"to_number",
		"to_integer",
	],
	operatorBindings: [
		{
			logicalId: CoreOperatorIds.gt,
			runtimeId: ">",
		},
		{
			logicalId: CoreOperatorIds.gte,
			runtimeId: ">=",
		},
		{
			logicalId: CoreOperatorIds.lt,
			runtimeId: "<",
		},
		{
			logicalId: CoreOperatorIds.lte,
			runtimeId: "<=",
		},
	],

	register({ operatorRegistry }) {
		registerGreaterThan(operatorRegistry);
		registerGreaterEqual(operatorRegistry);
		registerLessThan(operatorRegistry);
		registerLessEqual(operatorRegistry);
		registerBetween(operatorRegistry);
		registerMin(operatorRegistry);
		registerMax(operatorRegistry);
		registerPlus(operatorRegistry);
		registerMinus(operatorRegistry);
		registerMultiply(operatorRegistry);
		registerDivide(operatorRegistry);
		registerModulo(operatorRegistry);
		registerAbs(operatorRegistry);
		registerToNumber(operatorRegistry);
		registerToInteger(operatorRegistry);
	},

	unregister() {},
};

export default numericPlugin;
