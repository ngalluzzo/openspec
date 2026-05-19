import type { Plugin } from "@gooi/expresso-core";

import {
	registerAuthClaimEquals,
	registerAuthClaimIncludes,
} from "./auth-claims";
import {
	registerAuthHasScope,
	registerAuthIsOwner,
	registerAuthIsTenantMember,
} from "./auth-context";
import { registerAuthIsAuthenticated } from "./auth-identity";
import {
	registerAuthHasAllPermissions,
	registerAuthHasAnyPermission,
	registerAuthHasPermission,
} from "./auth-permissions";
import {
	registerAuthAllow,
	registerAuthAttributeMatch,
	registerAuthDeny,
} from "./auth-policy";
import {
	registerAuthHasAllRoles,
	registerAuthHasAnyRole,
	registerAuthHasRole,
} from "./auth-roles";

const authPlugin: Plugin = {
	name: "@std/auth",
	version: "1.0.0",
	description: "Authentication and authorization operators for Expresso",
	category: "auth",
	operators: [
		"auth_is_authenticated",
		"auth_has_role",
		"auth_has_any_role",
		"auth_has_all_roles",
		"auth_has_permission",
		"auth_has_any_permission",
		"auth_has_all_permissions",
		"auth_claim_equals",
		"auth_claim_includes",
		"auth_is_owner",
		"auth_is_tenant_member",
		"auth_has_scope",
		"auth_attribute_match",
		"auth_deny",
		"auth_allow",
	],
	dependencies: [
		"@std/data-access",
		"@std/logic",
		"@std/comparison",
		"@std/numeric",
	],

	register({ operatorRegistry }) {
		registerAuthIsAuthenticated(operatorRegistry);
		registerAuthHasRole(operatorRegistry);
		registerAuthHasAnyRole(operatorRegistry);
		registerAuthHasAllRoles(operatorRegistry);
		registerAuthHasPermission(operatorRegistry);
		registerAuthHasAnyPermission(operatorRegistry);
		registerAuthHasAllPermissions(operatorRegistry);
		registerAuthClaimEquals(operatorRegistry);
		registerAuthClaimIncludes(operatorRegistry);
		registerAuthIsOwner(operatorRegistry);
		registerAuthIsTenantMember(operatorRegistry);
		registerAuthHasScope(operatorRegistry);
		registerAuthAttributeMatch(operatorRegistry);
		registerAuthDeny(operatorRegistry);
		registerAuthAllow(operatorRegistry);
	},

	unregister() {},
};

export default authPlugin;
