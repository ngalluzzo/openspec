import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers regex match.
 *
 * @returns The result produced by `registerRegexMatch`.
 *
 * @example
 * registerRegexMatch();
 */

export function registerRegexMatch(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], boolean>("regex_match", {
		handler: ([pattern, string]) => {
			const str = String(string ?? "");
			try {
				const regex = new RegExp(pattern);
				return regex.test(str);
			} catch {
				throw new Error(`Invalid regex pattern: ${pattern}`);
			}
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "regex_match",
			title: "Regex Match",
			description: "Tests if a string matches a regular expression pattern",
			category: "regex",
			tags: ["regex", "validation", "string"],
			examples: [
				{
					description: "Match email format",
					input: {},
					rule: {
						regex_match: ["^[\\w.-]+@[\\w.-]+\\.\\w+$", "test@example.com"],
					},
					output: true,
				},
				{
					description: "Match phone number format",
					input: {},
					rule: { regex_match: ["^\\d{3}-\\d{3}-\\d{4}$", "555-123-4567"] },
					output: true,
				},
				{
					description: "No match",
					input: {},
					rule: { regex_match: ["^\\d+$", "abc123"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers regex replace.
 *
 * @returns The result produced by `registerRegexReplace`.
 *
 * @example
 * registerRegexReplace();
 */

export function registerRegexReplace(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string, string], string>("regex_replace", {
		handler: ([pattern, replacement, string]) => {
			const str = String(string ?? "");
			try {
				const regex = new RegExp(pattern, "g");
				return str.replace(regex, replacement);
			} catch {
				throw new Error(`Invalid regex pattern: ${pattern}`);
			}
		},
		inputSchema: z.tuple([z.string(), z.string(), z.string()]),
		outputSchema: z.string(),
		metadata: {
			name: "regex_replace",
			title: "Regex Replace",
			description:
				"Replaces all occurrences of a regex pattern with a replacement string",
			category: "regex",
			tags: ["regex", "string", "manipulation"],
			examples: [
				{
					description: "Replace all digits with X",
					input: {},
					rule: { regex_replace: ["\\d", "X", "Phone: 555-123-4567"] },
					output: "Phone: XXX-XXX-XXXX",
				},
				{
					description: "Remove extra whitespace",
					input: {},
					rule: { regex_replace: ["\\s+", " ", "Hello    World"] },
					output: "Hello World",
				},
				{
					description: "Redact SSN",
					input: {},
					rule: {
						regex_replace: [
							"\\d{3}-\\d{2}-(\\d{4})",
							"XXX-XX-$1",
							"SSN: 123-45-6789",
						],
					},
					output: "SSN: XXX-XX-6789",
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers regex extract.
 *
 * @returns The result produced by `registerRegexExtract`.
 *
 * @example
 * registerRegexExtract();
 */

export function registerRegexExtract(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], (string | null)[]>("regex_extract", {
		handler: ([pattern, string]) => {
			const str = String(string ?? "");
			try {
				const regex = new RegExp(pattern);
				const match = regex.exec(str);
				if (!match) return [];
				return Array.from(match);
			} catch {
				throw new Error(`Invalid regex pattern: ${pattern}`);
			}
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.array(z.union([z.string(), z.null()])),
		metadata: {
			name: "regex_extract",
			title: "Regex Extract",
			description:
				"Extracts all capture groups from a regex match. Returns array where index 0 is the full match, and subsequent indices are capture groups.",
			category: "regex",
			tags: ["regex", "string", "parsing"],
			examples: [
				{
					description: "Extract ICD-10 code parts",
					input: {},
					rule: { regex_extract: ["^([A-Z])(\\d{2})(\\.\\d{1})?$", "C12.3"] },
					output: ["C12.3", "C", "12", ".3"],
				},
				{
					description: "Extract date components",
					input: {},
					rule: {
						regex_extract: ["^(\\d{4})-(\\d{2})-(\\d{2})$", "2024-01-15"],
					},
					output: ["2024-01-15", "2024", "01", "15"],
				},
				{
					description: "No match returns empty array",
					input: {},
					rule: { regex_extract: ["^\\d+$", "abc"] },
					output: [],
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers regex test.
 *
 * @returns The result produced by `registerRegexTest`.
 *
 * @example
 * registerRegexTest();
 */

export function registerRegexTest(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], boolean>("regex_test", {
		handler: ([pattern, string]) => {
			const str = String(string ?? "");
			try {
				const regex = new RegExp(pattern);
				return regex.test(str);
			} catch {
				throw new Error(`Invalid regex pattern: ${pattern}`);
			}
		},
		inputSchema: z.tuple([z.string(), z.string()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "regex_test",
			title: "Regex Test",
			description:
				"Boolean test for whether a string matches a regex pattern. Alias for regex_match.",
			category: "regex",
			tags: ["regex", "validation", "string", "boolean"],
			aliases: ["regex_matches"],
			examples: [
				{
					description: "Test for uppercase letters only",
					input: {},
					rule: { regex_test: ["^[A-Z]+$", "HELLO"] },
					output: true,
				},
				{
					description: "Test for URL format",
					input: {},
					rule: { regex_test: ["^https?://", "https://example.com"] },
					output: true,
				},
				{
					description: "Test fails for invalid format",
					input: {},
					rule: { regex_test: ["^\\d{5}$", "123456"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
