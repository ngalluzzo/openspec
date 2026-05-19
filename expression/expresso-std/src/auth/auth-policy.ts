import {
	defineAsyncOperator,
	defineSyncOperator,
	evaluateRuleAsync,
} from "@gooi/expresso-core";
import type { OperatorRegistry, Rule } from "@gooi/expresso-core";

import { z } from "zod";
import { createAuthError, getAuthContext } from "./auth-helpers";
import { buildEvalOpts } from "../data-access/helpers";

/**
 * Registers auth attribute match.
 *
 * @returns The result produced by `registerAuthAttributeMatch`.
 *
 * @example
 * registerAuthAttributeMatch();
 */

export function registerAuthAttributeMatch(operatorRegistry: OperatorRegistry) {
	defineAsyncOperator<[Rule], boolean>("auth_attribute_match", {
		handler: async ([rule], data, ctx) => {
			const auth = getAuthContext(data);
			if (!auth) {
				return false;
			}
			try {
				const result = await evaluateRuleAsync(rule as Rule, auth, {
					...buildEvalOpts(ctx),
					lazy: ctx.lazy,
					debug: ctx.debug,
					maxDepth: ctx.maxDepth,
					truthinessMode: ctx.truthinessMode,
				});
				return result === true;
			} catch {
				return false;
			}
		},
		inputSchema: z.tuple([z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_attribute_match",
			title: "Attribute Match (ABAC)",
			description:
				"Evaluates an expresso rule against the auth context for arbitrary ABAC policies. Auth context fields (sub, roles, permissions, claims, tenantId, orgId, scope) are available as top-level variables.",
			category: "auth",
			tags: ["auth", "abac", "policy"],
			examples: [
				{
					description: "Complex ABAC rule checking claims",
					input: {
						auth: {
							sub: "user-123",
							claims: { department: "engineering", level: 5 },
						},
					},
					rule: {
						auth_attribute_match: [
							{
								and: [
									{ "==": [{ var: "claims.department" }, "engineering"] },
									{ ">=": [{ var: "claims.level" }, 3] },
								],
							},
						],
					},
					output: true,
				},
			],
			tests: [
				{
					name: "abac-match",
					description: "ABAC rule matches",
					input: {
						auth: {
							sub: "user-123",
							claims: { department: "engineering", level: 5 },
						},
					},
					args: [
						{
							and: [
								{ "==": [{ var: "claims.department" }, "engineering"] },
								{ ">=": [{ var: "claims.level" }, 3] },
							],
						},
					],
					expected: true,
				},
				{
					name: "abac-no-match",
					description: "ABAC rule does not match",
					input: {
						auth: { sub: "user-123", claims: { department: "marketing" } },
					},
					args: [{ "==": [{ var: "claims.department" }, "engineering"] }],
					expected: false,
				},
				{
					name: "no-auth-context",
					description: "No auth context",
					input: {},
					args: [{ "==": [{ var: "sub" }, "user-123"] }],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
			preserveRules: true,
		},
		eager: true,
	})(operatorRegistry);
}

/**
 * Registers auth deny.
 *
 * @returns The result produced by `registerAuthDeny`.
 *
 * @example
 * registerAuthDeny();
 */

export function registerAuthDeny(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[] | [string], never>("auth_deny", {
		handler: (args, _data) => {
			const reason = args.length > 0 ? args[0] : undefined;
			throw createAuthError(reason ?? "Access denied by policy", "AUTH_DENIED");
		},
		inputSchema: z.union([z.tuple([]), z.tuple([z.string().min(1)])]),
		outputSchema: z.never(),
		metadata: {
			name: "auth_deny",
			title: "Deny",
			description: "Unconditionally denies access, optionally with a reason",
			category: "auth",
			tags: ["auth", "policy", "deny"],
			examples: [],
			tests: [
				{
					name: "deny-with-reason",
					description: "Deny with custom message",
					input: {},
					args: ["Custom denial reason"],
					expected: null,
					throws: "Custom denial reason",
				},
				{
					name: "deny-default",
					description: "Deny with default message",
					input: {},
					args: [],
					expected: null,
					throws: "Access denied",
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth allow.
 *
 * @returns The result produced by `registerAuthAllow`.
 *
 * @example
 * registerAuthAllow();
 */

export function registerAuthAllow(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[], boolean>("auth_allow", {
		// biome-ignore lint/correctness/noEmptyPattern: operator takes no arguments
		handler: ([], _data) => {
			return true;
		},
		inputSchema: z.tuple([]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_allow",
			title: "Allow",
			description: "Unconditionally allows access",
			category: "auth",
			tags: ["auth", "policy", "allow"],
			examples: [
				{
					description: "Always allow",
					input: {},
					rule: { auth_allow: [] },
					output: true,
				},
			],
			tests: [
				{
					name: "allow",
					description: "Always returns true",
					input: {},
					args: [],
					expected: true,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
