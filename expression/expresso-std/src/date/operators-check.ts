import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers date between.
 *
 * @returns The result produced by `registerDateBetween`.
 *
 * @example
 * registerDateBetween();
 */

export function registerDateBetween(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string, string], boolean>("date_between", {
		handler: ([dateString, startDateString, endDateString]) => {
			const date = new Date(dateString);
			const startDate = new Date(startDateString);
			const endDate = new Date(endDateString);
			if (
				Number.isNaN(date.getTime()) ||
				Number.isNaN(startDate.getTime()) ||
				Number.isNaN(endDate.getTime())
			) {
				throw new Error(`Invalid date string(s)`);
			}
			return date >= startDate && date <= endDate;
		},
		inputSchema: z.tuple([z.string(), z.string(), z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "date_between",
			title: "Date Between",
			description: "Check if date is between start and end dates (inclusive)",
			category: "date",
			tags: ["date", "comparison"],
			examples: [
				{
					description: "Check if date is in range",
					input: {},
					rule: { date_between: ["2024-01-20", "2024-01-15", "2024-01-25"] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is weekday.
 *
 * @returns The result produced by `registerIsWeekday`.
 *
 * @example
 * registerIsWeekday();
 */

export function registerIsWeekday(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("is_weekday", {
		handler: ([dateString]) => {
			const date = new Date(dateString);
			if (Number.isNaN(date.getTime())) {
				throw new Error(`Invalid date string: ${dateString}`);
			}
			const day = date.getDay();
			return day >= 1 && day <= 5;
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_weekday",
			title: "Is Weekday",
			description: "Check if date is a weekday (Monday-Friday)",
			category: "date",
			tags: ["date", "validation"],
			examples: [
				{
					description: "Check if Monday is weekday",
					input: {},
					rule: { is_weekday: ["2024-01-15"] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is weekend.
 *
 * @returns The result produced by `registerIsWeekend`.
 *
 * @example
 * registerIsWeekend();
 */

export function registerIsWeekend(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("is_weekend", {
		handler: ([dateString]) => {
			const date = new Date(dateString);
			if (Number.isNaN(date.getTime())) {
				throw new Error(`Invalid date string: ${dateString}`);
			}
			const day = date.getDay();
			return day === 0 || day === 6;
		},
		inputSchema: z.tuple([z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_weekend",
			title: "Is Weekend",
			description: "Check if date is a weekend (Saturday-Sunday)",
			category: "date",
			tags: ["date", "validation"],
			examples: [
				{
					description: "Check if Saturday is weekend",
					input: {},
					rule: { is_weekend: ["2024-01-13"] },
					output: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
