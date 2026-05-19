import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";

/**
 * Registers is email.
 *
 * @returns The result produced by `registerIsEmail`.
 *
 * @example
 * registerIsEmail();
 */

export function registerIsEmail(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_email", {
		handler: (args) => {
			const [value] = args;
			const str = String(value ?? "");
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return emailRegex.test(str);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_email",
			title: "Is Email",
			description: "Check if value matches email format",
			category: "validation",
			tags: ["validation", "format-check", "email"],
			examples: [
				{
					description: "Valid email",
					input: {},
					rule: { is_email: ["user@example.com"] },
					output: true,
				},
				{
					description: "Email with subdomain",
					input: {},
					rule: { is_email: ["user@mail.example.com"] },
					output: true,
				},
				{
					description: "Invalid email - no @",
					input: {},
					rule: { is_email: ["userexample.com"] },
					output: false,
				},
				{
					description: "Invalid email - no domain",
					input: {},
					rule: { is_email: ["user@"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is url.
 *
 * @returns The result produced by `registerIsUrl`.
 *
 * @example
 * registerIsUrl();
 */

export function registerIsUrl(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_url", {
		handler: (args) => {
			const [value] = args;
			const str = String(value ?? "");
			const urlRegex = /^https?:\/\/.+\..+/;
			return urlRegex.test(str);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_url",
			title: "Is URL",
			description: "Check if value matches URL format (http or https)",
			category: "validation",
			tags: ["validation", "format-check", "url"],
			examples: [
				{
					description: "Valid HTTPS URL",
					input: {},
					rule: { is_url: ["https://example.com"] },
					output: true,
				},
				{
					description: "Valid HTTP URL",
					input: {},
					rule: { is_url: ["http://example.com/path"] },
					output: true,
				},
				{
					description: "Invalid URL - no protocol",
					input: {},
					rule: { is_url: ["example.com"] },
					output: false,
				},
				{
					description: "Invalid URL - not URL",
					input: {},
					rule: { is_url: ["not-a-url"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers is uuid.
 *
 * @returns The result produced by `registerIsUuid`.
 *
 * @example
 * registerIsUuid();
 */

export function registerIsUuid(operatorRegistry: OperatorRegistry) {
	defineSyncOperator("is_uuid", {
		handler: (args) => {
			const [value] = args;
			const str = String(value ?? "");
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
			return uuidRegex.test(str);
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "is_uuid",
			title: "Is UUID",
			description: "Check if value matches UUID v4 format",
			category: "validation",
			tags: ["validation", "format-check", "uuid"],
			examples: [
				{
					description: "Valid UUID v4",
					input: {},
					rule: { is_uuid: ["550e8400-e29b-41d4-a716-446655440000"] },
					output: true,
				},
				{
					description: "Valid UUID lowercase",
					input: {},
					rule: { is_uuid: ["550e8400-e29b-41d4-a716-446655440000"] },
					output: true,
				},
				{
					description: "Invalid UUID - wrong format",
					input: {},
					rule: { is_uuid: ["not-uuid"] },
					output: false,
				},
				{
					description: "Invalid UUID - uppercase",
					input: {},
					rule: { is_uuid: ["550E8400-E29B-41D4-A716-446655440000"] },
					output: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
