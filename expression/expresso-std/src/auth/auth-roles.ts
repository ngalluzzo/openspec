import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import { getAuthContext } from "./auth-helpers";

/**
 * Registers auth has role.
 *
 * @returns The result produced by `registerAuthHasRole`.
 *
 * @example
 * registerAuthHasRole();
 */

export function registerAuthHasRole(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("auth_has_role", {
		handler: ([roleName], data) => {
			const auth = getAuthContext(data);
			if (!auth?.roles) {
				return false;
			}
			return auth.roles.includes(roleName);
		},
		inputSchema: z.tuple([z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_role",
			title: "Has Role",
			description: "Returns true if the user has the specified role",
			category: "auth",
			tags: ["auth", "rbac", "role", "policy"],
			examples: [
				{
					description: "User has admin role",
					input: { auth: { sub: "user-123", roles: ["admin", "editor"] } },
					rule: { auth_has_role: ["admin"] },
					output: true,
				},
				{
					description: "User does not have role",
					input: { auth: { sub: "user-123", roles: ["viewer"] } },
					rule: { auth_has_role: ["admin"] },
					output: false,
				},
			],
			tests: [
				{
					name: "has-role",
					description: "User has the role",
					input: { auth: { roles: ["admin"] } },
					args: ["admin"],
					expected: true,
				},
				{
					name: "missing-role",
					description: "User lacks the role",
					input: { auth: { roles: ["viewer"] } },
					args: ["admin"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth has any role.
 *
 * @returns The result produced by `registerAuthHasAnyRole`.
 *
 * @example
 * registerAuthHasAnyRole();
 */

export function registerAuthHasAnyRole(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string[]], boolean>("auth_has_any_role", {
		handler: ([roleNames], data) => {
			const auth = getAuthContext(data);
			const roles = auth?.roles;
			if (!roles) {
				return false;
			}
			return roleNames.some((role) => roles.includes(role));
		},
		inputSchema: z.tuple([z.array(z.string().min(1)).min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_any_role",
			title: "Has Any Role",
			description: "Returns true if the user has any of the specified roles",
			category: "auth",
			tags: ["auth", "rbac", "role", "policy"],
			examples: [
				{
					description: "User has one of the roles",
					input: { auth: { sub: "user-123", roles: ["editor"] } },
					rule: { auth_has_any_role: [["admin", "editor"]] },
					output: true,
				},
				{
					description: "User has none of the roles",
					input: { auth: { sub: "user-123", roles: ["viewer"] } },
					rule: { auth_has_any_role: [["admin", "editor"]] },
					output: false,
				},
			],
			tests: [
				{
					name: "has-one",
					description: "User has one of the roles",
					input: { auth: { roles: ["editor"] } },
					args: [["admin", "editor"]],
					expected: true,
				},
				{
					name: "has-none",
					description: "User has none of the roles",
					input: { auth: { roles: ["viewer"] } },
					args: [["admin", "editor"]],
					expected: false,
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth has all roles.
 *
 * @returns The result produced by `registerAuthHasAllRoles`.
 *
 * @example
 * registerAuthHasAllRoles();
 */

export function registerAuthHasAllRoles(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string[]], boolean>("auth_has_all_roles", {
		handler: ([roleNames], data) => {
			const auth = getAuthContext(data);
			if (!auth?.roles) {
				return false;
			}
			const roles = auth.roles;
			return roleNames.every((role) => roles.includes(role));
		},
		inputSchema: z.tuple([z.array(z.string().min(1)).min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_all_roles",
			title: "Has All Roles",
			description: "Returns true if the user has all of the specified roles",
			category: "auth",
			tags: ["auth", "rbac", "role", "policy"],
			examples: [
				{
					description: "User has all roles",
					input: {
						auth: { sub: "user-123", roles: ["admin", "editor", "viewer"] },
					},
					rule: { auth_has_all_roles: [["admin", "editor"]] },
					output: true,
				},
				{
					description: "User missing one role",
					input: { auth: { sub: "user-123", roles: ["editor", "viewer"] } },
					rule: { auth_has_all_roles: [["admin", "editor"]] },
					output: false,
				},
			],
			tests: [
				{
					name: "has-all",
					description: "User has all roles",
					input: { auth: { roles: ["admin", "editor"] } },
					args: [["admin", "editor"]],
					expected: true,
				},
				{
					name: "missing-one",
					description: "User missing one role",
					input: { auth: { roles: ["editor"] } },
					args: [["admin", "editor"]],
					expected: false,
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
