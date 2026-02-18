import type { TupleKey } from "@openfga/sdk";

import { FGAClient } from "@/libs/openfga";
import { RoleService } from "@/services/role.service";

/**
 * Maps an org_role record's boolean flags to FGA tuples for a user in an org.
 */
function roleFlagsToTuples(
	userId: string,
	orgId: string,
	role: {
		is_master: boolean;
		is_admin: boolean;
		can_view: boolean;
		can_edit: boolean;
		have_api_access: boolean;
		have_billing_options: boolean;
		have_webhook_access: boolean;
	},
): TupleKey[] {
	const user = `user:${userId}`;
	const org = `org:${orgId}`;
	const tuples: TupleKey[] = [];

	// Always add member
	tuples.push({ user, relation: "member", object: org });

	if (role.is_master) tuples.push({ user, relation: "master", object: org });
	if (role.is_admin) tuples.push({ user, relation: "admin", object: org });
	if (role.can_view) tuples.push({ user, relation: "can_view", object: org });
	if (role.can_edit) tuples.push({ user, relation: "can_edit", object: org });
	if (role.have_api_access) tuples.push({ user, relation: "have_api_access", object: org });
	if (role.have_billing_options) tuples.push({ user, relation: "have_billing_options", object: org });
	if (role.have_webhook_access) tuples.push({ user, relation: "have_webhook_access", object: org });

	return tuples;
}

/** All org-level relations a user can be directly assigned to */
const ALL_ORG_RELATIONS = [
	"member",
	"master",
	"admin",
	"can_view",
	"can_edit",
	"have_api_access",
	"have_billing_options",
	"have_webhook_access",
] as const;

export class AuthorizationService {
	// ─── Core checks ───────────────────────────────────────────────────

	/**
	 * Check if a user has a specific relation/permission on an object.
	 *
	 * @param userId - EnvSync user ID (without `user:` prefix)
	 * @param relation - The FGA relation to check (e.g. "can_edit", "can_manage_apps")
	 * @param objectType - The FGA object type (e.g. "org", "app", "env_type")
	 * @param objectId - The EnvSync resource ID (without type prefix)
	 */
	static async check(userId: string, relation: string, objectType: string, objectId: string): Promise<boolean> {
		const fga = await FGAClient.getInstance();
		return fga.check(`user:${userId}`, relation, `${objectType}:${objectId}`);
	}

	/**
	 * Batch-check multiple permissions for a user.
	 * Returns a map of "relation:objectType:objectId" → boolean.
	 */
	static async batchCheck(
		userId: string,
		checks: { relation: string; objectType: string; objectId: string }[],
	): Promise<Map<string, boolean>> {
		const fga = await FGAClient.getInstance();
		const fgaChecks = checks.map(c => ({
			user: `user:${userId}`,
			relation: c.relation,
			object: `${c.objectType}:${c.objectId}`,
		}));
		return fga.batchCheck(fgaChecks);
	}

	// ─── Role template → FGA tuples ────────────────────────────────────

	/**
	 * Assign a role template to a user. Reads the org_role's boolean flags
	 * and writes the corresponding FGA tuples.
	 */
	static async assignRoleToUser(userId: string, orgId: string, roleId: string): Promise<void> {
		const role = await RoleService.getRole(roleId);
		const tuples = roleFlagsToTuples(userId, orgId, {
			...role,
			is_master: role.is_master ?? false,
		});
		const fga = await FGAClient.getInstance();
		await fga.writeTuples(tuples);
	}

	/**
	 * Remove all org-level FGA tuples for a user.
	 * Used before re-assigning a new role or on user deletion.
	 */
	static async removeUserOrgPermissions(userId: string, orgId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = `user:${userId}`;
		const org = `org:${orgId}`;

		// Read all existing tuples for this user on this org and delete them
		const existing = await fga.readTuples({ user, object: org });
		if (existing.length > 0) {
			await fga.deleteTuples(existing);
		}
	}

	/**
	 * Re-sync a user's FGA tuples when their role changes.
	 * Removes old tuples and writes new ones based on the new role.
	 */
	static async resyncUserRole(userId: string, orgId: string, newRoleId: string): Promise<void> {
		await this.removeUserOrgPermissions(userId, orgId);
		await this.assignRoleToUser(userId, orgId, newRoleId);
	}

	/**
	 * Re-sync all users who have a given role.
	 * Called when a role's boolean flags are updated.
	 */
	static async resyncAllUsersWithRole(roleId: string, orgId: string): Promise<void> {
		// Import lazily to avoid circular dependency
		const { DB } = await import("@/libs/db");
		const db = await DB.getInstance();

		const users = await db
			.selectFrom("users")
			.select("id")
			.where("role_id", "=", roleId)
			.where("org_id", "=", orgId)
			.execute();

		for (const user of users) {
			await this.resyncUserRole(user.id, orgId, roleId);
		}
	}

	// ─── Structural tuples (resource hierarchy) ────────────────────────

	/**
	 * Write the structural tuple linking an app to its org.
	 * Called when an app is created.
	 */
	static async writeAppOrgRelation(appId: string, orgId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([{ user: `org:${orgId}`, relation: "org", object: `app:${appId}` }]);
	}

	/**
	 * Write the structural tuples linking an env_type to its app and org.
	 * Called when an env_type is created.
	 */
	static async writeEnvTypeRelations(envTypeId: string, appId: string, orgId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([
			{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
			{ user: `org:${orgId}`, relation: "org", object: `env_type:${envTypeId}` },
		]);
	}

	/**
	 * Remove all FGA tuples where the given object is the target.
	 * Called when a resource (app, env_type) is deleted.
	 */
	static async deleteResourceTuples(objectType: string, objectId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		const object = `${objectType}:${objectId}`;

		// Read all tuples pointing to this object and delete them
		const existing = await fga.readTuples({ object });
		if (existing.length > 0) {
			await fga.deleteTuples(existing);
		}
	}

	// ─── Per-resource grants (fine-grained) ────────────────────────────

	/**
	 * Grant a user or team a relation on an app.
	 */
	static async grantAppAccess(
		subjectId: string,
		subjectType: "user" | "team",
		appId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.writeTuples([{ user, relation, object: `app:${appId}` }]);
	}

	/**
	 * Revoke a user or team's relation on an app.
	 */
	static async revokeAppAccess(
		subjectId: string,
		subjectType: "user" | "team",
		appId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.deleteTuples([{ user, relation, object: `app:${appId}` }]);
	}

	/**
	 * Grant a user or team a relation on an env_type.
	 */
	static async grantEnvTypeAccess(
		subjectId: string,
		subjectType: "user" | "team",
		envTypeId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.writeTuples([{ user, relation, object: `env_type:${envTypeId}` }]);
	}

	/**
	 * Revoke a user or team's relation on an env_type.
	 */
	static async revokeEnvTypeAccess(
		subjectId: string,
		subjectType: "user" | "team",
		envTypeId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.deleteTuples([{ user, relation, object: `env_type:${envTypeId}` }]);
	}

	// ─── Team membership ───────────────────────────────────────────────

	/**
	 * Add a user as a member of a team in FGA.
	 */
	static async addTeamMember(teamId: string, userId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([{ user: `user:${userId}`, relation: "member", object: `team:${teamId}` }]);
	}

	/**
	 * Remove a user from a team in FGA.
	 */
	static async removeTeamMember(teamId: string, userId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.deleteTuples([{ user: `user:${userId}`, relation: "member", object: `team:${teamId}` }]);
	}

	/**
	 * Write the structural tuple linking a team to its org.
	 */
	static async writeTeamOrgRelation(teamId: string, orgId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([{ user: `org:${orgId}`, relation: "org", object: `team:${teamId}` }]);
	}

	// ─── GPG key relations ────────────────────────────────────────────

	/**
	 * Write the structural tuples linking a GPG key to its org and owner.
	 * Called when a GPG key is created.
	 */
	static async writeGpgKeyRelations(gpgKeyId: string, orgId: string, ownerId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([
			{ user: `org:${orgId}`, relation: "org", object: `gpg_key:${gpgKeyId}` },
			{ user: `user:${ownerId}`, relation: "owner", object: `gpg_key:${gpgKeyId}` },
		]);
	}

	/**
	 * Grant a user or team a role on a GPG key (manager or signer).
	 */
	static async grantGpgKeyAccess(
		subjectId: string,
		subjectType: "user" | "team",
		gpgKeyId: string,
		relation: "manager" | "signer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.writeTuples([{ user, relation, object: `gpg_key:${gpgKeyId}` }]);
	}

	/**
	 * Revoke a user or team's role on a GPG key.
	 */
	static async revokeGpgKeyAccess(
		subjectId: string,
		subjectType: "user" | "team",
		gpgKeyId: string,
		relation: "manager" | "signer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.deleteTuples([{ user, relation, object: `gpg_key:${gpgKeyId}` }]);
	}

	// ─── Certificate relations ──────────────────────────────────────

	/**
	 * Write the structural tuples linking a certificate to its org and owner.
	 * Called when a certificate is created (initOrgCA or issueMemberCert).
	 */
	static async writeCertificateRelations(certId: string, orgId: string, ownerId: string): Promise<void> {
		const fga = await FGAClient.getInstance();
		await fga.writeTuples([
			{ user: `org:${orgId}`, relation: "org", object: `certificate:${certId}` },
			{ user: `user:${ownerId}`, relation: "owner", object: `certificate:${certId}` },
		]);
	}

	/**
	 * Grant a user or team a role on a certificate (manager or viewer).
	 */
	static async grantCertificateAccess(
		subjectId: string,
		subjectType: "user" | "team",
		certId: string,
		relation: "manager" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.writeTuples([{ user, relation, object: `certificate:${certId}` }]);
	}

	/**
	 * Revoke a user or team's role on a certificate.
	 */
	static async revokeCertificateAccess(
		subjectId: string,
		subjectType: "user" | "team",
		certId: string,
		relation: "manager" | "viewer",
	): Promise<void> {
		const fga = await FGAClient.getInstance();
		const user = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await fga.deleteTuples([{ user, relation, object: `certificate:${certId}` }]);
	}

	// ─── Introspection ─────────────────────────────────────────────────

	/**
	 * Get the effective org-level permissions for a user.
	 * Returns a flat object compatible with the legacy `permissions` shape
	 * for easier frontend consumption.
	 */
	static async getUserOrgPermissions(
		userId: string,
		orgId: string,
	): Promise<{
		can_view: boolean;
		can_edit: boolean;
		have_api_access: boolean;
		have_billing_options: boolean;
		have_webhook_access: boolean;
		is_admin: boolean;
		is_master: boolean;
		can_manage_roles: boolean;
		can_manage_users: boolean;
		can_manage_apps: boolean;
		can_manage_api_keys: boolean;
		can_manage_webhooks: boolean;
		can_view_audit_logs: boolean;
		can_manage_org_settings: boolean;
		can_manage_invites: boolean;
	}> {
		const relations = [
			"can_view",
			"can_edit",
			"have_api_access",
			"have_billing_options",
			"have_webhook_access",
			"admin",
			"master",
			"can_manage_roles",
			"can_manage_users",
			"can_manage_apps",
			"can_manage_api_keys",
			"can_manage_webhooks",
			"can_view_audit_logs",
			"can_manage_org_settings",
			"can_manage_invites",
		];

		const checks = relations.map(r => ({ relation: r, objectType: "org", objectId: orgId }));
		const results = await this.batchCheck(userId, checks);

		return {
			can_view: results.get(`can_view:org:${orgId}`) ?? false,
			can_edit: results.get(`can_edit:org:${orgId}`) ?? false,
			have_api_access: results.get(`have_api_access:org:${orgId}`) ?? false,
			have_billing_options: results.get(`have_billing_options:org:${orgId}`) ?? false,
			have_webhook_access: results.get(`have_webhook_access:org:${orgId}`) ?? false,
			is_admin: results.get(`admin:org:${orgId}`) ?? false,
			is_master: results.get(`master:org:${orgId}`) ?? false,
			can_manage_roles: results.get(`can_manage_roles:org:${orgId}`) ?? false,
			can_manage_users: results.get(`can_manage_users:org:${orgId}`) ?? false,
			can_manage_apps: results.get(`can_manage_apps:org:${orgId}`) ?? false,
			can_manage_api_keys: results.get(`can_manage_api_keys:org:${orgId}`) ?? false,
			can_manage_webhooks: results.get(`can_manage_webhooks:org:${orgId}`) ?? false,
			can_view_audit_logs: results.get(`can_view_audit_logs:org:${orgId}`) ?? false,
			can_manage_org_settings: results.get(`can_manage_org_settings:org:${orgId}`) ?? false,
			can_manage_invites: results.get(`can_manage_invites:org:${orgId}`) ?? false,
		};
	}
}
