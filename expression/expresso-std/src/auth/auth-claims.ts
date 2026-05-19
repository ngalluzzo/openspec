import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import { getAuthContext } from "./auth-helpers";

/**
 * Registers auth claim equals.
 *
 * @returns The result produced by `registerAuthClaimEquals`.
 *
 * @example
 * registerAuthClaimEquals();
 */

export function registerAuthClaimEquals(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, unknown], boolean>("auth_claim_equals", {
		handler: ([claimKey, expected], data) => {
			const auth = getAuthContext(data);
			if (!auth?.claims) {
				return false;
			}
			const actual = auth.claims[claimKey];
			return actual === expected;
		},
		inputSchema: z.tuple([z.string().min(1), z.any()]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_claim_equals",
			title: "Claim Equals",
			description:
				"Returns true if the specified claim equals the expected value",
			category: "auth",
			tags: ["auth", "claims", "policy"],
			examples: [
				{
					description: "Email verified claim",
					input: {
						auth: { sub: "user-123", claims: { email_verified: true } },
					},
					rule: { auth_claim_equals: ["email_verified", true] },
					output: true,
				},
			],
			tests: [
				{
					name: "equals",
					description: "Claim matches",
					input: { auth: { claims: { tier: "premium" } } },
					args: ["tier", "premium"],
					expected: true,
				},
				{
					name: "not-equals",
					description: "Claim does not match",
					input: { auth: { claims: { tier: "free" } } },
					args: ["tier", "premium"],
					expected: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth claim includes.
 *
 * @returns The result produced by `registerAuthClaimIncludes`.
 *
 * @example
 * registerAuthClaimIncludes();
 */

export function registerAuthClaimIncludes(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string, string], boolean>("auth_claim_includes", {
		handler: ([claimKey, token], data) => {
			const auth = getAuthContext(data);
			if (!auth?.claims) {
				return false;
			}
			const value = auth.claims[claimKey];
			if (typeof value === "string") {
				const tokens = value.split(/\s+/).filter(Boolean);
				return tokens.includes(token);
			}
			if (Array.isArray(value)) {
				return value.includes(token);
			}
			return false;
		},
		inputSchema: z.tuple([z.string().min(1), z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_claim_includes",
			title: "Claim Includes",
			description:
				"Returns true if the claim (string or array) includes the specified token",
			category: "auth",
			tags: ["auth", "claims", "policy"],
			examples: [
				{
					description: "Groups claim includes admin",
					input: {
						auth: {
							sub: "user-123",
							claims: { groups: "admin editor viewer" },
						},
					},
					rule: { auth_claim_includes: ["groups", "admin"] },
					output: true,
				},
				{
					description: "Array claim includes value",
					input: {
						auth: {
							sub: "user-123",
							claims: { teams: ["engineering", "product"] },
						},
					},
					rule: { auth_claim_includes: ["teams", "engineering"] },
					output: true,
				},
			],
			tests: [
				{
					name: "string-includes",
					description: "String claim includes token",
					input: { auth: { claims: { groups: "admin editor" } } },
					args: ["groups", "admin"],
					expected: true,
				},
				{
					name: "array-includes",
					description: "Array claim includes value",
					input: { auth: { claims: { teams: ["engineering"] } } },
					args: ["teams", "engineering"],
					expected: true,
				},
				{
					name: "not-includes",
					description: "Claim does not include",
					input: { auth: { claims: { groups: "viewer" } } },
					args: ["groups", "admin"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
