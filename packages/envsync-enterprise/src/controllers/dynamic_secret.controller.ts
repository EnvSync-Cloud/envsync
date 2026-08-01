import type { Context } from "hono";

import { assertEntitled } from "@/helpers/enterprise-guard";
import { DynamicSecretService } from "../services/dynamic_secret.service";
import { AuditLogService } from "@/services/audit_log.service";

export class DynamicSecretController {
	// ── Engines ────────────────────────────────────────────────────────────

	public static readonly createEngine = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { engine_type, name, config, enabled } = await c.req.json();

		const engine = await DynamicSecretService.createEngine({
			org_id,
			engine_type,
			name,
			config,
			enabled,
		});

		await AuditLogService.notifyAuditSystem({
			action: "dynamic_secret_engine_created",
			org_id,
			user_id,
			details: { engine_id: engine.id, engine_type, name },
			message: `Dynamic secret engine "${name}" (${engine_type}) created.`,
		});

		return c.json(engine, 201);
	};

	public static readonly getEngine = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");

		const engine = await DynamicSecretService.getEngine(id, org_id);
		return c.json(engine);
	};

	public static readonly getAllEngines = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");

		const engines = await DynamicSecretService.getAllEngines(org_id);
		return c.json(engines);
	};

	public static readonly updateEngine = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");
		const { name, config, enabled } = await c.req.json();

		const engine = await DynamicSecretService.updateEngine({
			id,
			org_id,
			name,
			config,
			enabled,
		});

		await AuditLogService.notifyAuditSystem({
			action: "dynamic_secret_engine_updated",
			org_id,
			user_id,
			details: { engine_id: id, name, enabled },
			message: `Dynamic secret engine "${engine.name}" updated.`,
		});

		return c.json(engine);
	};

	public static readonly deleteEngine = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");

		await DynamicSecretService.deleteEngine(id, org_id);

		await AuditLogService.notifyAuditSystem({
			action: "dynamic_secret_engine_deleted",
			org_id,
			user_id,
			details: { engine_id: id },
			message: `Dynamic secret engine deleted.`,
		});

		return c.json({ message: "Dynamic secret engine deleted successfully" });
	};

	// ── Leases ─────────────────────────────────────────────────────────────

	public static readonly createLease = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const engine_id = c.req.param("id");
		const { app_id, env_type_id, variable_key, ttl_seconds } = await c.req.json();

		const lease = await DynamicSecretService.createLease({
			engine_id,
			app_id,
			env_type_id,
			variable_key,
			ttl_seconds,
			org_id,
		});

		await AuditLogService.notifyAuditSystem({
			action: "dynamic_secret_lease_created",
			org_id,
			user_id,
			details: { lease_id: lease.id, engine_id, app_id, env_type_id, variable_key },
			message: `Dynamic secret lease created for variable "${variable_key}".`,
		});

		return c.json(lease, 201);
	};

	public static readonly getLease = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const id = c.req.param("leaseId");

		const lease = await DynamicSecretService.getLease(id, org_id);
		return c.json(lease);
	};

	public static readonly getLeasesByEngine = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const engine_id = c.req.param("id");

		const leases = await DynamicSecretService.getLeasesByEngine(engine_id, org_id);
		return c.json(leases);
	};

	public static readonly revokeLease = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const lease_id = c.req.param("leaseId");

		const result = await DynamicSecretService.revokeLease(lease_id, org_id);

		await AuditLogService.notifyAuditSystem({
			action: "dynamic_secret_lease_revoked",
			org_id,
			user_id,
			details: { lease_id },
			message: `Dynamic secret lease revoked.`,
		});

		return c.json(result);
	};

	public static readonly cleanupExpired = async (c: Context) => {
		await assertEntitled("dynamic_secrets");
		const org_id = c.get("org_id");

		const result = await DynamicSecretService.cleanupExpiredLeases();
		return c.json(result);
	};
}
