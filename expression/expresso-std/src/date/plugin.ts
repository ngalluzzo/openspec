import type { Plugin } from "@gooi/expresso-core";

import {
	registerDateFormat,
	registerDateParse,
	registerNow,
	registerToDateTime,
} from "./operators";
import { registerDateAdd, registerDateDiff } from "./operators-arithmetic";
import {
	registerDateBetween,
	registerIsWeekday,
	registerIsWeekend,
} from "./operators-check";

const datePlugin: Plugin = {
	name: "@std/date",
	version: "1.0.0",
	description: "Standard date operators for Expresso",
	category: "date",
	operators: [
		"to_datetime",
		"now",
		"date_parse",
		"date_format",
		"date_add",
		"date_diff",
		"date_between",
		"is_weekday",
		"is_weekend",
	],

	register({ operatorRegistry }) {
		registerToDateTime(operatorRegistry);
		registerNow(operatorRegistry);
		registerDateParse(operatorRegistry);
		registerDateFormat(operatorRegistry);
		registerDateAdd(operatorRegistry);
		registerDateDiff(operatorRegistry);
		registerDateBetween(operatorRegistry);
		registerIsWeekday(operatorRegistry);
		registerIsWeekend(operatorRegistry);
	},

	unregister() {},
};

export default datePlugin;
