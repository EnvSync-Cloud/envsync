import { STDBClient } from "@/libs/stdb";
import { RoleService } from "@/services/role.service";

interface AuthTuple {
	subject: string;
	relation: string;
	object_type: string;
	object_id: string;
}

/**
 * Maps an org_role record's boolean flags to auth tuples for a user in an org.
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
		have_gpg_access: boolean;
		have_cert_access: boolean;
		have_audit_access: boolean;
	},
): AuthTuple[] {
	const subject = `user:${userId}`;
	const tuples: AuthTuple[] = [];

	// Always add member
	tuples.push({ subject, relation: "member", object_type: "org", object_id: orgId });

	if (role.is_master) tuples.push({ subject, relation: "master", object_type: "org", object_id: orgId });
	if (role.is_admin) tuples.push({ subject, relation: "admin", object_type: "org", object_id: orgId });
	if (role.can_view) tuples.push({ subject, relation: "can_view", object_type: "org", object_id: orgId });
	if (role.can_edit) tuples.push({ subject, relation: "can_edit", object_type: "org", object_id: orgId });
	if (role.have_api_access) tuples.push({ subject, relation: "have_api_access", object_type: "org", object_id: orgId });
	if (role.have_billing_options) tuples.push({ subject, relation: "have_billing_options", object_type: "org", object_id: orgId });
	if (role.have_webhook_access) tuples.push({ subject, relation: "have_webhook_access", object_type: "org", object_id: orgId });
	if (role.have_gpg_access) tuples.push({ subject, relation: "have_gpg_access", object_type: "org", object_id: orgId });
	if (role.have_cert_access) tuples.push({ subject, relation: "have_cert_access", object_type: "org", object_id: orgId });
	if (role.have_audit_access) tuples.push({ subject, relation: "have_audit_access", object_type: "org", object_id: orgId });

	return tuples;
}

export class AuthorizationService {
	private static stdb() {
		return STDBClient.getInstance();
	}

	// ─── Core checks ───────────────────────────────────────────────────

	static async check(userId: string, relation: string, objectType: string, objectId: string): Promise<boolean> {
		const result = await this.stdb().callReducerWithResponse<{ allowed: boolean }>(
			"check_permission",
			[userId, relation, objectType, objectId],
			{ injectRootKey: false },
		);
		return result.allowed;
	}

	static async batchCheck(
		userId: string,
		checks: { relation: string; objectType: string; objectId: string }[],
	): Promise<Map<string, boolean>> {
		const checksJson = JSON.stringify(
			checks.map(c => ({
				relation: c.relation,
				object_type: c.objectType,
				object_id: c.objectId,
			})),
		);

		const results = await this.stdb().callReducerWithResponse<
			{ key: string; allowed: boolean }[]
		>("batch_check", [userId, checksJson], { injectRootKey: false });

		const map = new Map<string, boolean>();
		for (const r of results) {
			map.set(r.key, r.allowed);
		}
		return map;
	}

	// ─── Role template → auth tuples ──────────────────────────────────

	static async assignRoleToUser(userId: string, orgId: string, roleId: string): Promise<void> {
		const role = await RoleService.getRole(roleId);
		const tuples = roleFlagsToTuples(userId, orgId, {
			...role,
			is_master: role.is_master ?? false,
			have_gpg_access: role.have_gpg_access ?? false,
			have_cert_access: role.have_cert_access ?? false,
			have_audit_access: role.have_audit_access ?? false,
		});
		await this.stdb().callReducer("write_auth_tuples", [JSON.stringify(tuples)], { injectRootKey: false });
	}

	static async removeUserOrgPermissions(userId: string, orgId: string): Promise<void> {
		const subject = `user:${userId}`;

		// Read all existing tuples for this user on this org
		const existing = await this.stdb().callReducerWithResponse<AuthTuple[]>(
			"read_tuples",
			[subject, "", "org", orgId],
			{ injectRootKey: false },
		);

		if (existing.length > 0) {
			await this.stdb().callReducer(
				"delete_auth_tuples",
				[JSON.stringify(existing)],
				{ injectRootKey: false },
			);
		}
	}

	static async resyncUserRole(userId: string, orgId: string, newRoleId: string): Promise<void> {
		await this.removeUserOrgPermissions(userId, orgId);
		await this.assignRoleToUser(userId, orgId, newRoleId);
	}

	static async resyncAllUsersWithRole(roleId: string, orgId: string): Promise<void> {
		const users = await this.stdb().query<{ uuid: string }>(
			`SELECT uuid FROM user WHERE role_id = '${roleId}' AND org_id = '${orgId}'`,
		);

		for (const user of users) {
			await this.resyncUserRole(user.uuid, orgId, roleId);
		}
	}

	// ─── Structural tuples (resource hierarchy) ────────────────────────

	static async writeAppOrgRelation(appId: string, orgId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject: `org:${orgId}`, relation: "org", object_type: "app", object_id: appId }])],
			{ injectRootKey: false },
		);
	}

	static async writeEnvTypeRelations(envTypeId: string, appId: string, orgId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([
				{ subject: `app:${appId}`, relation: "app", object_type: "env_type", object_id: envTypeId },
				{ subject: `org:${orgId}`, relation: "org", object_type: "env_type", object_id: envTypeId },
			])],
			{ injectRootKey: false },
		);
	}

	static async deleteResourceTuples(objectType: string, objectId: string): Promise<void> {
		const existing = await this.stdb().callReducerWithResponse<AuthTuple[]>(
			"read_tuples",
			["", "", objectType, objectId],
			{ injectRootKey: false },
		);

		if (existing.length > 0) {
			await this.stdb().callReducer(
				"delete_auth_tuples",
				[JSON.stringify(existing)],
				{ injectRootKey: false },
			);
		}
	}

	// ─── Per-resource grants (fine-grained) ────────────────────────────

	static async grantAppAccess(
		subjectId: string,
		subjectType: "user" | "team",
		appId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "app", object_id: appId }])],
			{ injectRootKey: false },
		);
	}

	static async revokeAppAccess(
		subjectId: string,
		subjectType: "user" | "team",
		appId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"delete_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "app", object_id: appId }])],
			{ injectRootKey: false },
		);
	}

	static async grantEnvTypeAccess(
		subjectId: string,
		subjectType: "user" | "team",
		envTypeId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "env_type", object_id: envTypeId }])],
			{ injectRootKey: false },
		);
	}

	static async revokeEnvTypeAccess(
		subjectId: string,
		subjectType: "user" | "team",
		envTypeId: string,
		relation: "admin" | "editor" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"delete_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "env_type", object_id: envTypeId }])],
			{ injectRootKey: false },
		);
	}

	// ─── Team membership ───────────────────────────────────────────────

	static async addTeamMember(teamId: string, userId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject: `user:${userId}`, relation: "member", object_type: "team", object_id: teamId }])],
			{ injectRootKey: false },
		);
	}

	static async removeTeamMember(teamId: string, userId: string): Promise<void> {
		await this.stdb().callReducer(
			"delete_auth_tuples",
			[JSON.stringify([{ subject: `user:${userId}`, relation: "member", object_type: "team", object_id: teamId }])],
			{ injectRootKey: false },
		);
	}

	static async writeTeamOrgRelation(teamId: string, orgId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject: `org:${orgId}`, relation: "org", object_type: "team", object_id: teamId }])],
			{ injectRootKey: false },
		);
	}

	// ─── GPG key relations ────────────────────────────────────────────

	static async writeGpgKeyRelations(gpgKeyId: string, orgId: string, ownerId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([
				{ subject: `org:${orgId}`, relation: "org", object_type: "gpg_key", object_id: gpgKeyId },
				{ subject: `user:${ownerId}`, relation: "owner", object_type: "gpg_key", object_id: gpgKeyId },
			])],
			{ injectRootKey: false },
		);
	}

	static async grantGpgKeyAccess(
		subjectId: string,
		subjectType: "user" | "team",
		gpgKeyId: string,
		relation: "manager" | "signer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "gpg_key", object_id: gpgKeyId }])],
			{ injectRootKey: false },
		);
	}

	static async revokeGpgKeyAccess(
		subjectId: string,
		subjectType: "user" | "team",
		gpgKeyId: string,
		relation: "manager" | "signer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"delete_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "gpg_key", object_id: gpgKeyId }])],
			{ injectRootKey: false },
		);
	}

	// ─── Certificate relations ──────────────────────────────────────

	static async writeCertificateRelations(certId: string, orgId: string, ownerId: string): Promise<void> {
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([
				{ subject: `org:${orgId}`, relation: "org", object_type: "certificate", object_id: certId },
				{ subject: `user:${ownerId}`, relation: "owner", object_type: "certificate", object_id: certId },
			])],
			{ injectRootKey: false },
		);
	}

	static async grantCertificateAccess(
		subjectId: string,
		subjectType: "user" | "team",
		certId: string,
		relation: "manager" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"write_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "certificate", object_id: certId }])],
			{ injectRootKey: false },
		);
	}

	static async revokeCertificateAccess(
		subjectId: string,
		subjectType: "user" | "team",
		certId: string,
		relation: "manager" | "viewer",
	): Promise<void> {
		const subject = subjectType === "user" ? `user:${subjectId}` : `team:${subjectId}#member`;
		await this.stdb().callReducer(
			"delete_auth_tuples",
			[JSON.stringify([{ subject, relation, object_type: "certificate", object_id: certId }])],
			{ injectRootKey: false },
		);
	}

	// ─── Introspection ─────────────────────────────────────────────────

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
