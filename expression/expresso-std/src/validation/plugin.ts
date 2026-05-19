import type { Plugin } from "@gooi/expresso-core";

import { registerMatches, registerRequired } from "./field-checks";
import {
	registerIsEmail,
	registerIsUrl,
	registerIsUuid,
} from "./format-checks";
import {
	registerBetweenLength,
	registerEqualsLength,
	registerMaxLength,
	registerMinLength,
} from "./length-range";
import {
	registerIsNil,
	registerIsNull,
	registerIsUndefined,
} from "./nil-checks";
import {
	registerIsFinite,
	registerIsFiniteNumber,
	registerIsFloat,
	registerIsInteger,
	registerIsNaN,
	registerIsNumber,
} from "./number-type-checks";
import { registerExists, registerUnique } from "./projection-checks";
import {
	registerIsArray,
	registerIsBoolean,
	registerIsObject,
	registerIsString,
} from "./type-checks";
import {
	registerInRange,
	registerMaxValue,
	registerMinValue,
	registerRange,
} from "./value-range";

const validationPlugin: Plugin = {
	name: "@std/validation",
	version: "1.0.0",
	description: "Standard validation operators for Expresso",
	category: "validation",
	operators: [
		"is_null",
		"is_undefined",
		"is_nil",
		"is_nan",
		"is_finite",
		"is_integer",
		"is_float",
		"is_number",
		"is_finite_number",
		"is_string",
		"is_boolean",
		"is_array",
		"is_object",
		"is_email",
		"is_url",
		"is_uuid",
		"min_length",
		"max_length",
		"range",
		"in_range",
		"min_value",
		"max_value",
		"equals_length",
		"between_length",
		"unique",
		"exists",
		"required",
		"matches",
	],

	register({ operatorRegistry }) {
		registerIsNull(operatorRegistry);
		registerIsUndefined(operatorRegistry);
		registerIsNil(operatorRegistry);
		registerIsNaN(operatorRegistry);
		registerIsFinite(operatorRegistry);
		registerIsInteger(operatorRegistry);
		registerIsFloat(operatorRegistry);
		registerIsNumber(operatorRegistry);
		registerIsFiniteNumber(operatorRegistry);
		registerIsString(operatorRegistry);
		registerIsBoolean(operatorRegistry);
		registerIsArray(operatorRegistry);
		registerIsObject(operatorRegistry);
		registerIsEmail(operatorRegistry);
		registerIsUrl(operatorRegistry);
		registerIsUuid(operatorRegistry);
		registerMinLength(operatorRegistry);
		registerMaxLength(operatorRegistry);
		registerRange(operatorRegistry);
		registerInRange(operatorRegistry);
		registerMinValue(operatorRegistry);
		registerMaxValue(operatorRegistry);
		registerEqualsLength(operatorRegistry);
		registerBetweenLength(operatorRegistry);
		registerUnique(operatorRegistry);
		registerExists(operatorRegistry);
		registerRequired(operatorRegistry);
		registerMatches(operatorRegistry);
	},

	unregister() {},
};

export default validationPlugin;
