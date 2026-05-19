import type { Plugin } from "@gooi/expresso-core";

import {
	registerCamelCase,
	registerIsEmpty,
	registerJsonStringify,
	registerKebabCase,
	registerObjectIncludes,
	registerOsFind,
	registerOsFlatMap,
	registerOsLet,
	registerOsLiteral,
	registerOsMap,
	registerOsNodeId,
	registerOsObject,
	registerOsObjectFromEntries,
	registerOsUniqueMap,
	registerPascalCase,
	registerStrAfter,
} from "./operators";

const openspecPlugin: Plugin = {
	name: "@std/openspec",
	version: "1.0.0",
	description: "OpenSpec-specific operators for Expresso",
	category: "openspec",
	dependencies: ["@std/data-access", "@std/comparison", "@std/numeric"],
	operators: [
		"os_is_empty",
		"json_stringify",
		"object_includes",
		"kebab_case",
		"camel_case",
		"pascal_case",
		"str_after",
		"os_literal",
		"os_object",
		"os_let",
		"os_map",
		"os_flat_map",
		"os_unique_map",
		"os_find",
		"os_object_from_entries",
		"os_node_id",
	],

	register({ operatorRegistry }) {
		registerIsEmpty(operatorRegistry);
		registerJsonStringify(operatorRegistry);
		registerObjectIncludes(operatorRegistry);
		registerKebabCase(operatorRegistry);
		registerCamelCase(operatorRegistry);
		registerPascalCase(operatorRegistry);
		registerStrAfter(operatorRegistry);
		registerOsLiteral(operatorRegistry);
		registerOsObject(operatorRegistry);
		registerOsLet(operatorRegistry);
		registerOsMap(operatorRegistry);
		registerOsFlatMap(operatorRegistry);
		registerOsUniqueMap(operatorRegistry);
		registerOsFind(operatorRegistry);
		registerOsObjectFromEntries(operatorRegistry);
		registerOsNodeId(operatorRegistry);
	},

	unregister() {},
};

export default openspecPlugin;
