import { type Context } from "hono";
import { assertEntitled } from "@/helpers/enterprise-guard";
import { RotationService } from "../services/rotation.service";
import { AuditLogService } from "@/services/audit_log.service";
import { AuthorizationService } from "@/services/authorization.service";
import { EnvTypeService } from "@/services/env_type.service";

export class RotationController {
	public static readonly createPolicy = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();

		const { app_id, env_type_id, variable_key, engine_type, schedule_cron, dual_window_minutes, enabled, connection_config } = body;

		if (!app_id || !env_type_id || !variable_key || !engine_type || !schedule_cron) {
			return c.json(
				{ error: "app_id, env_type_id, variable_key, engine_type, and schedule_cron are required." },
				400,
			);
		}

		// Check permissions on the env type
		const canEdit = await AuthorizationService.check(user_id, "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to manage rotation for this environment." }, 403);
		}

		const policy = await RotationService.createPolicy({
			org_id,
			app_id,
			env_type_id,
			variable_key,
			engine_type,
			schedule_cron,
			dual_window_minutes: dual_window_minutes ?? 60,
			enabled: enabled ?? true,
			connection_config: connection_config ?? {},
		});

		await AuditLogService.notifyAuditSystem({
			action: "rotation_policy_created",
			org_id,
			user_id,
			message: `Rotation policy created for variable ${variable_key} with engine ${engine_type}.`,
			details: {
				policy_id: policy.id,
				app_id,
				env_type_id,
				engine_type,
				schedule_cron,
			},
		});

		return c.json(policy, 201);
	};

	public static readonly getPolicies = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const app_id = c.req.query("app_id");
		const env_type_id = c.req.query("env_type_id");
		const enabledStr = c.req.query("enabled");

		const enabled = enabledStr === "true" ? true : enabledStr === "false" ? false : undefined;

		const policies = await RotationService.getPolicies(org_id, {
			app_id,
			env_type_id,
			enabled,
		});

		return c.json(policies);
	};

	public static readonly getPolicy = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const { id } = c.req.param();

		const policy = await RotationService.getPolicyById(id, org_id);
		return c.json(policy);
	};

	public static readonly updatePolicy = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { id } = c.req.param();
		const body = await c.req.json();

		// Verify the policy exists first to check permissions
		const existing = await RotationService.getPolicyById(id, org_id);

		const canEdit = await AuthorizationService.check(user_id, "can_edit", "env_type", existing.env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to manage rotation for this environment." }, 403);
		}

		const updated = await RotationService.updatePolicy(id, org_id, {
			schedule_cron: body.schedule_cron,
			dual_window_minutes: body.dual_window_minutes,
			enabled: body.enabled,
			connection_config: body.connection_config,
		});

		await AuditLogService.notifyAuditSystem({
			action: "rotation_policy_updated",
			org_id,
			user_id,
			message: `Rotation policy ${id} updated.`,
			details: { policy_id: id },
		});

		return c.json(updated);
	};

	public static readonly deletePolicy = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { id } = c.req.param();

		// Verify exists and check permissions
		const existing = await RotationService.getPolicyById(id, org_id);

		const canEdit = await AuthorizationService.check(user_id, "can_edit", "env_type", existing.env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to manage rotation for this environment." }, 403);
		}

		await RotationService.deletePolicy(id, org_id);

		await AuditLogService.notifyAuditSystem({
			action: "rotation_policy_deleted",
			org_id,
			user_id,
			message: `Rotation policy deleted for variable ${existing.variable_key}.`,
			details: { policy_id: id, variable_key: existing.variable_key },
		});

		return c.json({ message: "Rotation policy deleted successfully" });
	};

	public static readonly triggerRotation = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { id } = c.req.param();

		// Verify exists and check permissions
		const existing = await RotationService.getPolicyById(id, org_id);

		const canEdit = await AuthorizationService.check(user_id, "can_edit", "env_type", existing.env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to trigger rotation for this environment." }, 403);
		}

		const result = await RotationService.executeRotation(id, org_id);

		await AuditLogService.notifyAuditSystem({
			action: "rotation_triggered",
			org_id,
			user_id,
			message: `Secret rotation triggered for variable ${existing.variable_key}.`,
			details: {
				policy_id: id,
				variable_key: existing.variable_key,
				rotation_state_id: result.rotation_state_id,
			},
		});

		return c.json({
			message: "Rotation executed successfully",
			...result,
		});
	};

	public static readonly getRotationStates = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const { id } = c.req.param();

		const states = await RotationService.getRotationStates(id, org_id);
		return c.json(states);
	};

	public static readonly revokeExpiredCredentials = async (c: Context) => {
		await assertEntitled("rotation");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const results = await RotationService.revokeExpiredCredentials(org_id);

		await AuditLogService.notifyAuditSystem({
			action: "rotation_expired_credentials_revoked",
			org_id,
			user_id,
			message: `Expired credential revocation completed. ${results.length} credentials processed.`,
			details: { processed_count: results.length },
		});

		return c.json({
			message: "Expired credential revocation completed",
			processed: results.length,
			results,
		});
	};
}
