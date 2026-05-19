import { defineSyncOperator, type OperatorRegistry } from "@gooi/expresso-core";

import { z } from "zod";
import { getAuthContext, getValueByPath } from "./auth-helpers";

/**
 * Registers auth is owner.
 *
 * @returns The result produced by `registerAuthIsOwner`.
 *
 * @example
 * registerAuthIsOwner();
 */

export function registerAuthIsOwner(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("auth_is_owner", {
		handler: ([inputPath], data) => {
			const auth = getAuthContext(data);
			if (!auth?.sub) {
				return false;
			}
			const inputValue = getValueByPath(data, inputPath);
			return auth.sub === inputValue;
		},
		inputSchema: z.tuple([z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_is_owner",
			title: "Is Owner",
			description:
				"Returns true if the authenticated user ID matches the value at the specified path",
			category: "auth",
			tags: ["auth", "ownership", "policy"],
			examples: [
				{
					description: "User owns the resource",
					input: { auth: { sub: "user-123" }, input: { ownerId: "user-123" } },
					rule: { auth_is_owner: ["input.ownerId"] },
					output: true,
				},
				{
					description: "User does not own the resource",
					input: { auth: { sub: "user-123" }, input: { ownerId: "user-456" } },
					rule: { auth_is_owner: ["input.ownerId"] },
					output: false,
				},
			],
			tests: [
				{
					name: "is-owner",
					description: "User is owner",
					input: {
						auth: { sub: "user-123" },
						resource: { ownerId: "user-123" },
					},
					args: ["resource.ownerId"],
					expected: true,
				},
				{
					name: "not-owner",
					description: "User is not owner",
					input: {
						auth: { sub: "user-123" },
						resource: { ownerId: "user-456" },
					},
					args: ["resource.ownerId"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth is tenant member.
 *
 * @returns The result produced by `registerAuthIsTenantMember`.
 *
 * @example
 * registerAuthIsTenantMember();
 */

export function registerAuthIsTenantMember(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("auth_is_tenant_member", {
		handler: ([tenantIdPath], data) => {
			const auth = getAuthContext(data);
			if (!auth?.tenantId) {
				return false;
			}
			const inputTenantId = getValueByPath(data, tenantIdPath);
			return auth.tenantId === inputTenantId;
		},
		inputSchema: z.tuple([z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_is_tenant_member",
			title: "Is Tenant Member",
			description:
				"Returns true if the user belongs to the tenant specified at the path",
			category: "auth",
			tags: ["auth", "tenant", "multitenancy", "policy"],
			examples: [
				{
					description: "User is tenant member",
					input: {
						auth: { sub: "user-123", tenantId: "tenant-abc" },
						input: { tenantId: "tenant-abc" },
					},
					rule: { auth_is_tenant_member: ["input.tenantId"] },
					output: true,
				},
			],
			tests: [
				{
					name: "is-member",
					description: "User is tenant member",
					input: {
						auth: { tenantId: "tenant-abc" },
						resource: { tenantId: "tenant-abc" },
					},
					args: ["resource.tenantId"],
					expected: true,
				},
				{
					name: "not-member",
					description: "User is not member",
					input: {
						auth: { tenantId: "tenant-xyz" },
						resource: { tenantId: "tenant-abc" },
					},
					args: ["resource.tenantId"],
					expected: false,
				},
				{
					name: "no-tenant",
					description: "User has no tenant",
					input: {
						auth: { sub: "user-123" },
						resource: { tenantId: "tenant-abc" },
					},
					args: ["resource.tenantId"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}

/**
 * Registers auth has scope.
 *
 * @returns The result produced by `registerAuthHasScope`.
 *
 * @example
 * registerAuthHasScope();
 */

export function registerAuthHasScope(operatorRegistry: OperatorRegistry) {
	defineSyncOperator<[string], boolean>("auth_has_scope", {
		handler: ([scope], data) => {
			const auth = getAuthContext(data);
			if (!auth?.scope) {
				return false;
			}
			return auth.scope.includes(scope);
		},
		inputSchema: z.tuple([z.string().min(1)]),
		outputSchema: z.boolean(),
		metadata: {
			name: "auth_has_scope",
			title: "Has Scope",
			description: "Returns true if the user has the specified OAuth scope",
			category: "auth",
			tags: ["auth", "oauth", "scope", "policy"],
			examples: [
				{
					description: "User has read scope",
					input: { auth: { sub: "user-123", scope: ["read", "write"] } },
					rule: { auth_has_scope: ["read"] },
					output: true,
				},
			],
			tests: [
				{
					name: "has-scope",
					description: "User has scope",
					input: { auth: { scope: ["read", "write"] } },
					args: ["read"],
					expected: true,
				},
				{
					name: "missing-scope",
					description: "Missing scope",
					input: { auth: { scope: ["read"] } },
					args: ["admin"],
					expected: false,
				},
			],
			complexity: "O(n)",
			jsonlogicCompatible: false,
		},
	})(operatorRegistry);
}
