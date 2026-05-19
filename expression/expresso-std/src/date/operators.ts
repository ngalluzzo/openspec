import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers now.
 *
 * @returns The result produced by `registerNow`.
 *
 * @example
 * registerNow();
 */

export function registerNow(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[], number>("now", {
		handler: () => Date.now(),
		inputSchema: z.tuple([]),
		outputSchema: z.number(),
		metadata: {
			name: "now",
			title: "Now",
			description: "Current timestamp",
			category: "date",
			tags: ["time", "timestamp"],
			examples: [],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers to date time.
 *
 * @returns The result produced by `registerToDateTime`.
 *
 * @example
 * registerToDateTime();
 */

export function registerToDateTime(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[unknown], string>("to_datetime", {
		handler: ([value]) => {
			if (typeof value === "number") {
				return new Date(value * 1000).toISOString();
			}
			if (typeof value === "string" || value instanceof Date) {
				const date = new Date(value);
				if (Number.isNaN(date.getTime())) {
					throw new Error(`Invalid datetime value: ${value}`);
				}
				return date.toISOString();
			}
			throw new Error("Invalid datetime value");
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.string(),
		metadata: {
			name: "to_datetime",
			title: "To Datetime",
			description: "Convert timestamp or date string to ISO datetime",
			category: "date",
			tags: ["date", "parsing"],
			examples: [
				{
					description: "Convert epoch seconds to ISO",
					input: {},
					rule: { to_datetime: [0] },
					output: "1970-01-01T00:00:00.000Z",
				},
				{
					description: "Convert date string to ISO",
					input: {},
					rule: { to_datetime: ["2024-01-15"] },
					output: "2024-01-15T00:00:00.000Z",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: true,
		},
	})(operatorRegistry);
}

/**
 * Registers date parse.
 *
 * @returns The result produced by `registerDateParse`.
 *
 * @example
 * registerDateParse();
 */

export function registerDateParse(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], string>("date_parse", {
		handler: ([dateString]) => {
			const date = new Date(dateString);
			if (Number.isNaN(date.getTime())) {
				throw new Error(`Invalid date string: ${dateString}`);
			}
			return date.toISOString();
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "date_parse",
			title: "Date Parse",
			description: "Parse date string to ISO format",
			category: "date",
			tags: ["date", "parsing"],
			examples: [
				{
					description: "Parse date string",
					input: {},
					rule: { date_parse: ["2024-01-15"] },
					output: "2024-01-15T00:00:00.000Z",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers date format.
 *
 * @returns The result produced by `registerDateFormat`.
 *
 * @example
 * registerDateFormat();
 */

export function registerDateFormat(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], string>("date_format", {
		handler: ([dateString, format]) => {
			const date = new Date(dateString);
			if (Number.isNaN(date.getTime())) {
				throw new Error(`Invalid date string: ${dateString}`);
			}
			return format
				.replace("%Y", String(date.getFullYear()))
				.replace("%m", String(date.getMonth() + 1).padStart(2, "0"))
				.replace("%d", String(date.getDate()).padStart(2, "0"))
				.replace("%H", String(date.getHours()).padStart(2, "0"))
				.replace("%M", String(date.getMinutes()).padStart(2, "0"))
				.replace("%S", String(date.getSeconds()).padStart(2, "0"));
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "date_format",
			title: "Date Format",
			description:
				"Format date string using custom format. Supports: %Y (year), %m (month), %d (day), %H (hour), %M (minute), %S (second)",
			category: "date",
			tags: ["date", "formatting"],
			examples: [
				{
					description: "Format date to custom format",
					input: {},
					rule: {
						date_format: ["2024-01-15T10:30:00.000Z", "%Y-%m-%d %H:%M:%S"],
					},
					output: "2024-01-15 10:30:00",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
