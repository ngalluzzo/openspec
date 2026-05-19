import { CoreOperatorIds, type Plugin } from "@gooi/expresso-core";

import { registerFilter, registerMap, registerReduce } from "./array-iteration";
import { registerAll, registerNone, registerSome } from "./array-predicates";
import {
	registerFind,
	registerFindIndex,
	registerGroupBy,
} from "./array-search";
import {
	registerDifference,
	registerIntersection,
	registerUnion,
} from "./array-set";
import {
	registerFlatten,
	registerMerge,
	registerSort,
	registerSortBy,
	registerUnique,
} from "./array-transform";
import {
	registerMissing,
	registerMissingSome,
	registerVar,
} from "./var-access";

const dataAccessPlugin: Plugin = {
	name: "@std/data-access",
	version: "1.0.0",
	description: "Standard data-access and array operators for Expresso",
	category: "data-access",
	operators: [
		CoreOperatorIds.var,
		"missing",
		"missing_some",
		"map",
		"reduce",
		"filter",
		"all",
		"none",
		"some",
		"merge",
		"flatten",
		"unique",
		"sort",
		"sort_by",
		"find",
		"find_index",
		"group_by",
		"intersection",
		"difference",
		"union",
	],
	operatorBindings: [
		{
			logicalId: CoreOperatorIds.var,
			runtimeId: "var",
		},
	],
	dependencies: ["@std/numeric", "@std/comparison"],

	register({ operatorRegistry }) {
		registerVar(operatorRegistry);
		registerMissing(operatorRegistry);
		registerMissingSome(operatorRegistry);
		registerMap(operatorRegistry);
		registerReduce(operatorRegistry);
		registerFilter(operatorRegistry);
		registerAll(operatorRegistry);
		registerNone(operatorRegistry);
		registerSome(operatorRegistry);
		registerMerge(operatorRegistry);
		registerFlatten(operatorRegistry);
		registerUnique(operatorRegistry);
		registerSort(operatorRegistry);
		registerSortBy(operatorRegistry);
		registerFind(operatorRegistry);
		registerFindIndex(operatorRegistry);
		registerGroupBy(operatorRegistry);
		registerIntersection(operatorRegistry);
		registerDifference(operatorRegistry);
		registerUnion(operatorRegistry);
	},

	unregister() {},
};

export default dataAccessPlugin;
