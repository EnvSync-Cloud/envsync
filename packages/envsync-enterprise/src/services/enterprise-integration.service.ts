import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { NotFoundError, ValidationError } from "@/libs/errors";
import { AppService } from "@/services/app.service";
import { EnvTypeService } from "@/services/env_type.service";
import {
	EnterpriseProviderService,
	type EnterpriseProvider,
} from "@/services/enterprise-provider.service";

export class EnterpriseIntegrationService {
	public static listProviderConnections(org_id: string) {
		return DB.getInstance().then(db =>
			db
				.selectFrom("provider_connection")
				.selectAll()
				.where("org_id", "=", org_id)
				.orderBy("created_at", "desc")
				.execute(),
		);
	}

	public static async createProviderConnection(input: {
		org_id: string;
		provider_type: string;
		name: string;
		auth_config?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
		status?: "active" | "inactive" | "error";
	}) {
		EnterpriseProviderService.validateProviderConnection({
			provider_type: input.provider_type,
			status: input.status,
			auth_config: input.auth_config,
		});
		EnterpriseProviderService.assertProvider(input.provider_type);
		const db = await DB.getInstance();
		const row = {
			id: uuidv4(),
			org_id: input.org_id,
			provider_type: input.provider_type,
			name: input.name,
			status: input.status ?? "active",
			auth_config: input.auth_config ?? {},
			metadata: input.metadata ?? {},
			created_at: new Date(),
			updated_at: new Date(),
		};

		await db.insertInto("provider_connection").values(row).executeTakeFirstOrThrow();
		return row;
	}

	public static async updateProviderConnection(id: string, org_id: string, input: {
		name?: string;
		auth_config?: Record<string, unknown>;
		metadata?: Record<string, unknown>;
		status?: "active" | "inactive" | "error";
	}) {
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("provider_connection")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();
		if (!existing) {
			throw new NotFoundError("ProviderConnection", id);
		}

		EnterpriseProviderService.validateProviderConnection({
			provider_type: existing.provider_type,
			status: input.status ?? existing.status,
			auth_config: input.auth_config ?? existing.auth_config,
		});

		await db
			.updateTable("provider_connection")
			.set({
				...input,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return db.selectFrom("provider_connection").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	}

	public static listOrgSecrets(org_id: string) {
		return DB.getInstance().then(db =>
			db.selectFrom("org_secret").selectAll().where("org_id", "=", org_id).orderBy("created_at", "desc").execute(),
		);
	}

	public static async createOrgSecret(input: {
		org_id: string;
		key: string;
		value: string;
		description?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		const db = await DB.getInstance();
		const row = {
			id: uuidv4(),
			org_id: input.org_id,
			key: input.key,
			value: input.value,
			description: input.description ?? null,
			metadata: input.metadata ?? {},
			created_at: new Date(),
			updated_at: new Date(),
		};

		await db.insertInto("org_secret").values(row).executeTakeFirstOrThrow();
		return row;
	}

	public static async updateOrgSecret(id: string, org_id: string, input: {
		value?: string;
		description?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("org_secret")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();
		if (!existing) {
			throw new NotFoundError("OrgSecret", id);
		}

		await db
			.updateTable("org_secret")
			.set({
				...input,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return db.selectFrom("org_secret").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	}

	private static async assertAppInOrg(app_id: string, org_id: string) {
		const app = await AppService.getApp({ id: app_id });
		if (app.org_id !== org_id) {
			throw new ValidationError("App does not belong to your organization.");
		}
		return app;
	}

	private static async assertEnvTypeInApp(env_type_id: string, app_id: string, org_id: string) {
		const envType = await EnvTypeService.getEnvType(env_type_id);
		if (envType.org_id !== org_id || envType.app_id !== app_id) {
			throw new ValidationError("Environment type does not belong to this application.");
		}
		return envType;
	}

	public static async listBindings(org_id: string, app_id: string) {
		await this.assertAppInOrg(app_id, org_id);
		const db = await DB.getInstance();
		return db
			.selectFrom("integration_binding")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("app_id", "=", app_id)
			.orderBy("created_at", "desc")
			.execute();
	}

	public static async createBinding(input: {
		org_id: string;
		app_id: string;
		provider_connection_id: string;
		provider_type: string;
		is_enabled?: boolean;
		metadata?: Record<string, unknown>;
	}) {
		EnterpriseProviderService.assertProvider(input.provider_type);
		await this.assertAppInOrg(input.app_id, input.org_id);
		const db = await DB.getInstance();
		const connection = await db
			.selectFrom("provider_connection")
			.selectAll()
			.where("id", "=", input.provider_connection_id)
			.where("org_id", "=", input.org_id)
			.executeTakeFirst();
		if (!connection) {
			throw new NotFoundError("ProviderConnection", input.provider_connection_id);
		}

		EnterpriseProviderService.validateBinding({
			provider_type: input.provider_type,
			connection_provider_type: connection.provider_type,
			metadata: input.metadata,
		});

		const row = {
			id: uuidv4(),
			org_id: input.org_id,
			app_id: input.app_id,
			provider_connection_id: input.provider_connection_id,
			provider_type: input.provider_type,
			is_enabled: input.is_enabled ?? true,
			metadata: input.metadata ?? {},
			created_at: new Date(),
			updated_at: new Date(),
		};
		await db.insertInto("integration_binding").values(row).executeTakeFirstOrThrow();
		return row;
	}

	public static async updateBinding(id: string, org_id: string, app_id: string, input: {
		is_enabled?: boolean;
		metadata?: Record<string, unknown>;
	}) {
		await this.assertAppInOrg(app_id, org_id);
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("integration_binding")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.where("app_id", "=", app_id)
			.executeTakeFirst();
		if (!existing) {
			throw new NotFoundError("IntegrationBinding", id);
		}

		const connection = await db
			.selectFrom("provider_connection")
			.selectAll()
			.where("id", "=", existing.provider_connection_id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();
		if (!connection) {
			throw new NotFoundError("ProviderConnection", existing.provider_connection_id);
		}

		EnterpriseProviderService.validateBinding({
			provider_type: existing.provider_type,
			connection_provider_type: connection.provider_type,
			metadata: input.metadata ?? existing.metadata,
		});

		await db
			.updateTable("integration_binding")
			.set({
				...input,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return db.selectFrom("integration_binding").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	}

	public static async listMappings(org_id: string, app_id: string) {
		await this.assertAppInOrg(app_id, org_id);
		const db = await DB.getInstance();
		return db
			.selectFrom("env_type_mapping")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("app_id", "=", app_id)
			.orderBy("created_at", "desc")
			.execute();
	}

	public static async createMapping(input: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		integration_binding_id: string;
		target_identifier: string;
		branch_ref?: string | null;
		path_prefix?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		await this.assertAppInOrg(input.app_id, input.org_id);
		await this.assertEnvTypeInApp(input.env_type_id, input.app_id, input.org_id);
		const db = await DB.getInstance();
		const binding = await db
			.selectFrom("integration_binding")
			.selectAll()
			.where("id", "=", input.integration_binding_id)
			.where("org_id", "=", input.org_id)
			.where("app_id", "=", input.app_id)
			.executeTakeFirst();
		if (!binding) {
			throw new NotFoundError("IntegrationBinding", input.integration_binding_id);
		}

		EnterpriseProviderService.validateMapping({
			provider_type: binding.provider_type,
			target_identifier: input.target_identifier,
			branch_ref: input.branch_ref,
			path_prefix: input.path_prefix,
			metadata: input.metadata,
		});

		const row = {
			id: uuidv4(),
			org_id: input.org_id,
			app_id: input.app_id,
			env_type_id: input.env_type_id,
			integration_binding_id: input.integration_binding_id,
			target_identifier: input.target_identifier,
			branch_ref: input.branch_ref ?? null,
			path_prefix: input.path_prefix ?? null,
			metadata: input.metadata ?? {},
			created_at: new Date(),
			updated_at: new Date(),
		};
		await db.insertInto("env_type_mapping").values(row).executeTakeFirstOrThrow();
		return row;
	}

	public static async updateMapping(id: string, org_id: string, app_id: string, input: {
		target_identifier?: string;
		branch_ref?: string | null;
		path_prefix?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		await this.assertAppInOrg(app_id, org_id);
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("env_type_mapping")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.where("app_id", "=", app_id)
			.executeTakeFirst();
		if (!existing) {
			throw new NotFoundError("EnvTypeMapping", id);
		}

		const binding = await db
			.selectFrom("integration_binding")
			.selectAll()
			.where("id", "=", existing.integration_binding_id)
			.where("org_id", "=", org_id)
			.where("app_id", "=", app_id)
			.executeTakeFirst();
		if (!binding) {
			throw new NotFoundError("IntegrationBinding", existing.integration_binding_id);
		}

		EnterpriseProviderService.validateMapping({
			provider_type: binding.provider_type,
			target_identifier: input.target_identifier ?? existing.target_identifier,
			branch_ref: input.branch_ref ?? existing.branch_ref,
			path_prefix: input.path_prefix ?? existing.path_prefix,
			metadata: input.metadata ?? existing.metadata,
		});

		await db
			.updateTable("env_type_mapping")
			.set({
				...input,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return db.selectFrom("env_type_mapping").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
	}

	public static async listSyncRuns(org_id: string, app_id?: string) {
		const db = await DB.getInstance();
		let query = db
			.selectFrom("sync_run")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("started_at", "desc");
		if (app_id) {
			await this.assertAppInOrg(app_id, org_id);
			query = query.where("app_id", "=", app_id);
		}
		return query.execute();
	}

	public static async createManualSyncRun(input: {
		org_id: string;
		app_id?: string | null;
		provider_type: string;
		actor_user_id?: string | null;
		metadata?: Record<string, unknown>;
	}) {
		EnterpriseProviderService.assertProvider(input.provider_type);
		if (input.app_id) {
			await this.assertAppInOrg(input.app_id, input.org_id);
		}
		const db = await DB.getInstance();
		const now = new Date();
		const run = {
			id: uuidv4(),
			org_id: input.org_id,
			app_id: input.app_id ?? null,
			provider_type: input.provider_type,
			status: "pending" as const,
			actor_user_id: input.actor_user_id ?? null,
			started_at: now,
			completed_at: null,
			error_message: null,
			metadata: input.metadata ?? {},
			created_at: now,
			updated_at: now,
		};
		await db.insertInto("sync_run").values(run).executeTakeFirstOrThrow();

		await db.insertInto("sync_audit_event").values({
			id: uuidv4(),
			org_id: input.org_id,
			sync_run_id: run.id,
			app_id: input.app_id ?? null,
			env_type_id: null,
			provider_type: input.provider_type,
			action: "manual_sync_requested",
			result: "info",
			actor_user_id: input.actor_user_id ?? null,
			details: input.metadata ?? {},
			created_at: now,
			updated_at: now,
		}).executeTakeFirstOrThrow();

		const { EnterpriseSyncService } = await import("@/services/enterprise-sync.service");
		await EnterpriseSyncService.executeRun(run.id);

		return db
			.selectFrom("sync_run")
			.selectAll()
			.where("id", "=", run.id)
			.executeTakeFirstOrThrow();
	}

	public static async listSyncAuditEvents(org_id: string, sync_run_id: string) {
		const db = await DB.getInstance();
		const run = await db
			.selectFrom("sync_run")
			.selectAll()
			.where("id", "=", sync_run_id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();
		if (!run) {
			throw new NotFoundError("SyncRun", sync_run_id);
		}
		return db
			.selectFrom("sync_audit_event")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("sync_run_id", "=", sync_run_id)
			.orderBy("created_at", "asc")
			.execute();
	}
}
