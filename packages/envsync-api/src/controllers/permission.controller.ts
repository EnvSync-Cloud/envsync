import { type Context } from "hono";

import { AuthorizationService } from "@/services/authorization.service";
import { AppService } from "@/services/app.service";
import { EnvTypeService } from "@/services/env_type.service";
import { AuditLogService } from "@/services/audit_log.service";

export class PermissionController {
	public static readonly grantAppAccess = async (c: Context) => {
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const { subject_id, subject_type, relation } = await c.req.json();

		if (!subject_id || !subject_type || !relation) {
			return c.json({ error: "subject_id, subject_type, and relation are required." }, 400);
		}

		const app = await AppService.getApp({ id: app_id });
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to your organization." }, 403);
		}

		await AuthorizationService.grantAppAccess(subject_id, subject_type, app_id, relation);

		await AuditLogService.notifyAuditSystem({
			action: "permission_granted",
			org_id,
			user_id: c.get("user_id"),
			message: `Granted ${relation} access on app ${app.name} to ${subject_type}:${subject_id}.`,
			details: { app_id, subject_id, subject_type, relation },
		});

		return c.json({ message: "Access granted successfully." });
	};

	public static readonly revokeAppAccess = async (c: Context) => {
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const { subject_id, subject_type, relation } = await c.req.json();

		if (!subject_id || !subject_type || !relation) {
			return c.json({ error: "subject_id, subject_type, and relation are required." }, 400);
		}

		const app = await AppService.getApp({ id: app_id });
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to your organization." }, 403);
		}

		await AuthorizationService.revokeAppAccess(subject_id, subject_type, app_id, relation);

		await AuditLogService.notifyAuditSystem({
			action: "permission_revoked",
			org_id,
			user_id: c.get("user_id"),
			message: `Revoked ${relation} access on app ${app.name} from ${subject_type}:${subject_id}.`,
			details: { app_id, subject_id, subject_type, relation },
		});

		return c.json({ message: "Access revoked successfully." });
	};

	public static readonly grantEnvTypeAccess = async (c: Context) => {
		const org_id = c.get("org_id");
		const env_type_id = c.req.param("id");
		const { subject_id, subject_type, relation } = await c.req.json();

		if (!subject_id || !subject_type || !relation) {
			return c.json({ error: "subject_id, subject_type, and relation are required." }, 400);
		}

		const envType = await EnvTypeService.getEnvType(env_type_id);
		if (envType.org_id !== org_id) {
			return c.json({ error: "Environment type does not belong to your organization." }, 403);
		}

		await AuthorizationService.grantEnvTypeAccess(subject_id, subject_type, env_type_id, relation);

		await AuditLogService.notifyAuditSystem({
			action: "permission_granted",
			org_id,
			user_id: c.get("user_id"),
			message: `Granted ${relation} access on env_type ${envType.name} to ${subject_type}:${subject_id}.`,
			details: { env_type_id, subject_id, subject_type, relation },
		});

		return c.json({ message: "Access granted successfully." });
	};

	public static readonly revokeEnvTypeAccess = async (c: Context) => {
		const org_id = c.get("org_id");
		const env_type_id = c.req.param("id");
		const { subject_id, subject_type, relation } = await c.req.json();

		if (!subject_id || !subject_type || !relation) {
			return c.json({ error: "subject_id, subject_type, and relation are required." }, 400);
		}

		const envType = await EnvTypeService.getEnvType(env_type_id);
		if (envType.org_id !== org_id) {
			return c.json({ error: "Environment type does not belong to your organization." }, 403);
		}

		await AuthorizationService.revokeEnvTypeAccess(subject_id, subject_type, env_type_id, relation);

		await AuditLogService.notifyAuditSystem({
			action: "permission_revoked",
			org_id,
			user_id: c.get("user_id"),
			message: `Revoked ${relation} access on env_type ${envType.name} from ${subject_type}:${subject_id}.`,
			details: { env_type_id, subject_id, subject_type, relation },
		});

		return c.json({ message: "Access revoked successfully." });
	};

	public static readonly getMyPermissions = async (c: Context) => {
		const user_id = c.get("user_id");
		const org_id = c.get("org_id");

		const permissions = await AuthorizationService.getUserOrgPermissions(user_id, org_id);

		return c.json(permissions);
	};
}
