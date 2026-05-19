import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import { getAuthContext } from "./auth-helpers";

/**
 * Registers auth is authenticated.
 *
 * @returns The result produced by `registerAuthIsAuthenticated`.
 *
 * @example
 * registerAuthIsAuthenticated();
 */

export function registerAuthIsAuthenticated(
	operatorRegistry: OperatorRegistry,
) {
	defineSyncOperator<[], boolean>("auth_is_authenticated", {
		// biome-ignore lint/correctness/noEmptyPattern: operator takes no arguments
		handler: ([], data) => {
			const auth = getAuthContext(data);
			if (!auth?.sub) {
				return false;
			}
			if (auth.expiresAt) {
				const expiresAt = new Date(auth.expiresAt);
				if (expiresAt.getTime() < Date.now()) {
					return false;
				}
			}
			return true;
		},
		inputSchema: z.tuple([]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_is_authenticated",
			title: "Is Authenticated",
			description:
				"Returns true if the user has a valid authentication context",
			category: "auth",
			tags: ["auth", "authentication", "policy"],
			examples: [
				{
					description: "Authenticated user",
					input: { auth: { sub: "user-123", provider: "supabase" } },
					rule: { auth_is_authenticated: [] },
					output: true,
				},
				{
					description: "Unauthenticated user",
					input: { auth: {} },
					rule: { auth_is_authenticated: [] },
					output: false,
				},
			],
			tests: [
				{
					name: "authenticated",
					description: "Valid auth context",
					input: { auth: { sub: "user-123" } },
					args: [],
					expected: true,
				},
				{
					name: "not-authenticated",
					description: "Missing auth context",
					input: {},
					args: [],
					expected: false,
				},
				{
					name: "expired",
					description: "Expired token",
					input: {
						auth: { sub: "user-123", expiresAt: "2020-01-01T00:00:00Z" },
					},
					args: [],
					expected: false,
				},
			],
			complexity: "O(1)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
