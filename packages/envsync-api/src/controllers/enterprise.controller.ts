import type { Context } from "hono";

import { assertEnterprise } from "@/helpers/enterprise-guard";
import { AuditLogService } from "@/services/audit_log.service";
import { EnterpriseIntegrationService } from "@/services/enterprise-integration.service";
import { EnterpriseProviderService } from "@/services/enterprise-provider.service";

export class EnterpriseController {
	public static readonly getProviders = async (c: Context) => {
		assertEnterprise();
		return c.json({
			providers: EnterpriseProviderService.listProviders(),
		});
	};

	public static readonly getOrgSecretModel = async (c: Context) => {
		assertEnterprise();
		return c.json({
			resource: "org_secret",
			description: "Org-level reusable secret material for enterprise integrations.",
			fields: ["key", "description", "provider_refs", "rotation_policy", "last_rotated_at"],
		});
	};

	public static readonly listProviderConnections = async (c: Context) => {
		assertEnterprise();
		return c.json(await EnterpriseIntegrationService.listProviderConnections(c.get("org_id")));
	};

	public static readonly createProviderConnection = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const payload = c.req.valid("json" as never) as Omit<
			Parameters<typeof EnterpriseIntegrationService.createProviderConnection>[0],
			"org_id"
		>;
		const created = await EnterpriseIntegrationService.createProviderConnection({
			org_id,
			...payload,
		});
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_provider_connection_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise provider connection ${created.name} created.`,
			details: {
				provider_connection_id: created.id,
				provider_type: created.provider_type,
				name: created.name,
			},
		});
		return c.json(created, 201);
	};

	public static readonly updateProviderConnection = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const payload = c.req.valid("json" as never);
		const updated = await EnterpriseIntegrationService.updateProviderConnection(
			c.req.param("id"),
			org_id,
			payload,
		);
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_provider_connection_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise provider connection ${updated.name} updated.`,
			details: {
				provider_connection_id: updated.id,
				provider_type: updated.provider_type,
				name: updated.name,
			},
		});
		return c.json(updated);
	};

	public static readonly listOrgSecrets = async (c: Context) => {
		assertEnterprise();
		return c.json(await EnterpriseIntegrationService.listOrgSecrets(c.get("org_id")));
	};

	public static readonly createOrgSecret = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const payload = c.req.valid("json" as never) as Omit<
			Parameters<typeof EnterpriseIntegrationService.createOrgSecret>[0],
			"org_id"
		>;
		const created = await EnterpriseIntegrationService.createOrgSecret({
			org_id,
			...payload,
		});
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_org_secret_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise org secret ${created.key} created.`,
			details: {
				org_secret_id: created.id,
				key: created.key,
			},
		});
		return c.json(created, 201);
	};

	public static readonly updateOrgSecret = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const payload = c.req.valid("json" as never);
		const updated = await EnterpriseIntegrationService.updateOrgSecret(c.req.param("id"), org_id, payload);
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_org_secret_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise org secret ${updated.key} updated.`,
			details: {
				org_secret_id: updated.id,
				key: updated.key,
			},
		});
		return c.json(updated);
	};

	public static readonly listBindings = async (c: Context) => {
		assertEnterprise();
		return c.json(await EnterpriseIntegrationService.listBindings(c.get("org_id"), c.req.param("app_id")));
	};

	public static readonly createBinding = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const payload = c.req.valid("json" as never) as Omit<
			Parameters<typeof EnterpriseIntegrationService.createBinding>[0],
			"org_id" | "app_id"
		>;
		const created = await EnterpriseIntegrationService.createBinding({
			org_id,
			app_id,
			...payload,
		});
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_integration_binding_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise integration binding created for app ${app_id}.`,
			details: {
				integration_binding_id: created.id,
				app_id,
				provider_type: created.provider_type,
			},
		});
		return c.json(created, 201);
	};

	public static readonly updateBinding = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const payload = c.req.valid("json" as never);
		const updated = await EnterpriseIntegrationService.updateBinding(c.req.param("id"), org_id, app_id, payload);
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_integration_binding_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise integration binding ${updated.id} updated.`,
			details: {
				integration_binding_id: updated.id,
				app_id,
				provider_type: updated.provider_type,
			},
		});
		return c.json(updated);
	};

	public static readonly listMappings = async (c: Context) => {
		assertEnterprise();
		return c.json(await EnterpriseIntegrationService.listMappings(c.get("org_id"), c.req.param("app_id")));
	};

	public static readonly createMapping = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const payload = c.req.valid("json" as never) as Omit<
			Parameters<typeof EnterpriseIntegrationService.createMapping>[0],
			"org_id" | "app_id"
		>;
		const created = await EnterpriseIntegrationService.createMapping({
			org_id,
			app_id,
			...payload,
		});
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_env_mapping_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise env-type mapping ${created.id} created.`,
			details: {
				env_type_mapping_id: created.id,
				app_id,
				env_type_id: created.env_type_id,
				target_identifier: created.target_identifier,
			},
		});
		return c.json(created, 201);
	};

	public static readonly updateMapping = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const app_id = c.req.param("app_id");
		const payload = c.req.valid("json" as never);
		const updated = await EnterpriseIntegrationService.updateMapping(c.req.param("id"), org_id, app_id, payload);
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_env_mapping_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise env-type mapping ${updated.id} updated.`,
			details: {
				env_type_mapping_id: updated.id,
				app_id,
				env_type_id: updated.env_type_id,
				target_identifier: updated.target_identifier,
			},
		});
		return c.json(updated);
	};

	public static readonly listSyncRuns = async (c: Context) => {
		assertEnterprise();
		const app_id = c.req.query("app_id");
		return c.json(await EnterpriseIntegrationService.listSyncRuns(c.get("org_id"), app_id));
	};

	public static readonly createManualSyncRun = async (c: Context) => {
		assertEnterprise();
		const org_id = c.get("org_id");
		const payload = c.req.valid("json" as never) as Omit<
			Parameters<typeof EnterpriseIntegrationService.createManualSyncRun>[0],
			"org_id" | "actor_user_id"
		>;
		const created = await EnterpriseIntegrationService.createManualSyncRun({
			org_id,
			actor_user_id: c.get("user_id"),
			...payload,
		});
		await AuditLogService.notifyAuditSystem({
			action: "enterprise_sync_run_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Enterprise manual sync run ${created.id} created.`,
			details: {
				sync_run_id: created.id,
				app_id: created.app_id,
				provider_type: created.provider_type,
			},
		});
		return c.json(created, 201);
	};

	public static readonly listSyncAuditEvents = async (c: Context) => {
		assertEnterprise();
		return c.json(await EnterpriseIntegrationService.listSyncAuditEvents(c.get("org_id"), c.req.param("sync_run_id")));
	};
}
