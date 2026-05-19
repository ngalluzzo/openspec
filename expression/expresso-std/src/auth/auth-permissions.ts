import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import { getAuthContext } from "./auth-helpers";

/**
 * Registers auth has permission.
 *
 * @returns The result produced by `registerAuthHasPermission`.
 *
 * @example
 * registerAuthHasPermission();
 */

export function registerAuthHasPermission(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("auth_has_permission", {
		handler: ([permissionName], data) => {
			const auth = getAuthContext(data);
			if (!auth?.permissions) {
				return false;
			}
			return auth.permissions.includes(permissionName);
		},
		inputSchema: z.tuple([z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_permission",
			title: "Has Permission",
			description: "Returns true if the user has the specified permission",
			category: "auth",
			tags: ["auth", "rbac", "permission", "policy"],
			examples: [
				{
					description: "User has permission",
					input: {
						auth: {
							sub: "user-123",
							permissions: ["tasks:create", "tasks:read"],
						},
					},
					rule: { auth_has_permission: ["tasks:create"] },
					output: true,
				},
				{
					description: "User lacks permission",
					input: { auth: { sub: "user-123", permissions: ["tasks:read"] } },
					rule: { auth_has_permission: ["tasks:delete"] },
					output: false,
				},
			],
			tests: [
				{
					name: "has-permission",
					description: "User has the permission",
					input: { auth: { permissions: ["tasks:create"] } },
					args: ["tasks:create"],
					expected: true,
				},
				{
					name: "missing-permission",
					description: "User lacks the permission",
					input: { auth: { permissions: ["tasks:read"] } },
					args: ["tasks:create"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth has any permission.
 *
 * @returns The result produced by `registerAuthHasAnyPermission`.
 *
 * @example
 * registerAuthHasAnyPermission();
 */

export function registerAuthHasAnyPermission(
	operatorRegistry: OperatorRegistry,
) {
	defineSyncOperator<[string[]], boolean>("auth_has_any_permission", {
		handler: ([permissionNames], data) => {
			const auth = getAuthContext(data);
			const permissions = auth?.permissions;
			if (!permissions) {
				return false;
			}
			return permissionNames.some((perm) => permissions.includes(perm));
		},
		inputSchema: z.tuple([z.array(z.string().min(1)).min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_any_permission",
			title: "Has Any Permission",
			description:
				"Returns true if the user has any of the specified permissions",
			category: "auth",
			tags: ["auth", "rbac", "permission", "policy"],
			examples: [
				{
					description: "User has one of the permissions",
					input: { auth: { sub: "user-123", permissions: ["tasks:read"] } },
					rule: { auth_has_any_permission: [["tasks:create", "tasks:read"]] },
					output: true,
				},
			],
			tests: [
				{
					name: "has-one",
					description: "User has one permission",
					input: { auth: { permissions: ["tasks:read"] } },
					args: [["tasks:create", "tasks:read"]],
					expected: true,
				},
				{
					name: "has-none",
					description: "User has none",
					input: { auth: { permissions: ["tasks:list"] } },
					args: [["tasks:create", "tasks:delete"]],
					expected: false,
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth has all permissions.
 *
 * @returns The result produced by `registerAuthHasAllPermissions`.
 *
 * @example
 * registerAuthHasAllPermissions();
 */

export function registerAuthHasAllPermissions(
	operatorRegistry: OperatorRegistry,
) {
	defineSyncOperator<[string[]], boolean>("auth_has_all_permissions", {
		handler: ([permissionNames], data) => {
			const auth = getAuthContext(data);
			const permissions = auth?.permissions;
			if (!permissions) {
				return false;
			}
			return permissionNames.every((perm) => permissions.includes(perm));
		},
		inputSchema: z.tuple([z.array(z.string().min(1)).min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_all_permissions",
			title: "Has All Permissions",
			description:
				"Returns true if the user has all of the specified permissions",
			category: "auth",
			tags: ["auth", "rbac", "permission", "policy"],
			examples: [
				{
					description: "User has all permissions",
					input: {
						auth: {
							sub: "user-123",
							permissions: ["tasks:create", "tasks:read", "tasks:delete"],
						},
					},
					rule: { auth_has_all_permissions: [["tasks:create", "tasks:read"]] },
					output: true,
				},
			],
			tests: [
				{
					name: "has-all",
					description: "User has all",
					input: { auth: { permissions: ["tasks:create", "tasks:read"] } },
					args: [["tasks:create", "tasks:read"]],
					expected: true,
				},
				{
					name: "missing-one",
					description: "Missing one",
					input: { auth: { permissions: ["tasks:read"] } },
					args: [["tasks:create", "tasks:read"]],
					expected: false,
				},
			],
			complexity: "O(n*m)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
