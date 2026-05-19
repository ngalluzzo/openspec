import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers date add.
 *
 * @returns The result produced by `registerDateAdd`.
 *
 * @example
 * registerDateAdd();
 */

export function registerDateAdd(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, number, string], string>("date_add", {
		handler: ([dateString, amount, unit]) => {
			const date = new Date(dateString);
			if (Number.isNaN(date.getTime())) {
				throw new Error(`Invalid date string: ${dateString}`);
			}
			switch (unit) {
				case "years":
					date.setFullYear(date.getFullYear() + amount);
					break;
				case "months":
					date.setMonth(date.getMonth() + amount);
					break;
				case "days":
					date.setDate(date.getDate() + amount);
					break;
				case "hours":
					date.setHours(date.getHours() + amount);
					break;
				case "minutes":
					date.setMinutes(date.getMinutes() + amount);
					break;
				case "seconds":
					date.setSeconds(date.getSeconds() + amount);
					break;
				default:
					throw new Error(
						`Invalid unit: ${unit}. Supported: years, months, days, hours, minutes, seconds`,
					);
			}
			return date.toISOString();
		},
		inputSchema: z.tuple([
			z.string(),
			z.number(),
			z.enum(["years", "months", "days", "hours", "minutes", "seconds"]),
		]),
		outputSchema: z.string(),
		metadata: {
			name: "date_add",
			title: "Date Add",
			description:
				"Add time to a date. Supported units: years, months, days, hours, minutes, seconds",
			category: "date",
			tags: ["date", "arithmetic"],
			examples: [
				{
					description: "Add 7 days to date",
					input: {},
					rule: { date_add: ["2024-01-15", 7, "days"] },
					output: "2024-01-22T00:00:00.000Z",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers date diff.
 *
 * @returns The result produced by `registerDateDiff`.
 *
 * @example
 * registerDateDiff();
 */

export function registerDateDiff(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string, string], number>("date_diff", {
		handler: ([dateString1, dateString2, unit]) => {
			const date1 = new Date(dateString1);
			const date2 = new Date(dateString2);
			if (Number.isNaN(date1.getTime()) || Number.isNaN(date2.getTime())) {
				throw new Error(`Invalid date string(s)`);
			}
			const diffMs = date1.getTime() - date2.getTime();
			let result: number;
			switch (unit) {
				case "years":
					result = diffMs / (1000 * 60 * 60 * 24 * 365);
					break;
				case "months":
					result = diffMs / (1000 * 60 * 60 * 24 * 30);
					break;
				case "days":
					result = diffMs / (1000 * 60 * 60 * 24);
					break;
				case "hours":
					result = diffMs / (1000 * 60 * 60);
					break;
				case "minutes":
					result = diffMs / (1000 * 60);
					break;
				case "seconds":
					result = diffMs / 1000;
					break;
				default:
					throw new Error(
						`Invalid unit: ${unit}. Supported: years, months, days, hours, minutes, seconds`,
					);
			}
			return Math.round(result);
		},
		inputSchema: z.tuple([
			z.string(),
			z.string(),
			z.enum(["years", "months", "days", "hours", "minutes", "seconds"]),
		]),
		outputSchema: z.number(),
		metadata: {
			name: "date_diff",
			title: "Date Diff",
			description: "Calculate difference between two dates in specified unit",
			category: "date",
			tags: ["date", "arithmetic"],
			examples: [
				{
					description: "Days between two dates",
					input: {},
					rule: { date_diff: ["2024-01-22", "2024-01-15", "days"] },
					output: 7,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
