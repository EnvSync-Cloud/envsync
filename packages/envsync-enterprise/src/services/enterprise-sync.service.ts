import { DB } from "@/libs/db";
import log, { LogTypes } from "@/libs/logger";
import { NotFoundError, ValidationError } from "@/libs/errors";
import { EnvService } from "@/services/env.service";
import { EnterpriseProviderSyncService } from "@/services/enterprise-provider-sync.service";
import { EnvTypeService } from "@/services/env_type.service";
import { SecretService } from "@/services/secret.service";

import { EnterpriseProviderService, type EnterpriseProvider } from "./enterprise-provider.service";

type SyncRunRow = {
	id: string;
	org_id: string;
	app_id: string | null;
	provider_type: EnterpriseProvider;
	status: "pending" | "running" | "succeeded" | "failed";
	actor_user_id: string | null;
	started_at: Date;
	completed_at: Date | null;
	error_message: string | null;
	metadata: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
};

type BindingRow = {
	id: string;
	org_id: string;
	app_id: string;
	provider_connection_id: string;
	provider_type: EnterpriseProvider;
	is_enabled: boolean;
	metadata: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
};

type ProviderConnectionRow = {
	id: string;
	org_id: string;
	provider_type: EnterpriseProvider;
	name: string;
	status: "active" | "inactive" | "error";
	auth_config: Record<string, unknown>;
	metadata: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
};

type MappingRow = {
	id: string;
	org_id: string;
	app_id: string;
	env_type_id: string;
	integration_binding_id: string;
	target_identifier: string;
	branch_ref: string | null;
	path_prefix: string | null;
	metadata: Record<string, unknown>;
	created_at: Date;
	updated_at: Date;
};

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isWorkerPassRunning = false;

export class EnterpriseSyncService {
	private static readonly workerIntervalMs = 30_000;

	public static startWorker() {
		if (workerTimer) {
			return;
		}

		workerTimer = setInterval(() => {
			void this.processPendingSyncRuns().catch(error => {
				log(
					`Enterprise sync worker pass failed: ${error instanceof Error ? error.message : String(error)}`,
					LogTypes.ERROR,
					"EnterpriseSyncService",
				);
			});
		}, this.workerIntervalMs);

		void this.processPendingSyncRuns().catch(error => {
			log(
				`Initial enterprise sync worker pass failed: ${error instanceof Error ? error.message : String(error)}`,
				LogTypes.ERROR,
				"EnterpriseSyncService",
			);
		});
	}

	public static async processPendingSyncRuns(limit = 10) {
		if (isWorkerPassRunning) {
			return;
		}

		isWorkerPassRunning = true;
		try {
			const db = await DB.getInstance();
			const pendingRuns = await db
				.selectFrom("sync_run")
				.selectAll()
				.where("status", "=", "pending")
				.orderBy("created_at", "asc")
				.limit(limit)
				.execute();

			for (const run of pendingRuns) {
				await this.executeRun(run.id);
			}
		} finally {
			isWorkerPassRunning = false;
		}
	}

	public static async executeRun(sync_run_id: string) {
		const db = await DB.getInstance();
		const claimedRun = await db
			.updateTable("sync_run")
			.set({
				status: "running",
				error_message: null,
				completed_at: null,
				updated_at: new Date(),
			})
			.where("id", "=", sync_run_id)
			.where("status", "=", "pending")
			.returningAll()
			.executeTakeFirst();

		const run = claimedRun ?? await db
			.selectFrom("sync_run")
			.selectAll()
			.where("id", "=", sync_run_id)
			.executeTakeFirst();

		if (!run) {
			throw new NotFoundError("SyncRun", sync_run_id);
		}

		if (run.status === "succeeded" || run.status === "failed") {
			return run;
		}

		const activeRun = (claimedRun ?? run) as SyncRunRow;

		try {
			await this.appendAuditEvent({
				org_id: activeRun.org_id,
				sync_run_id: activeRun.id,
				app_id: activeRun.app_id,
				env_type_id: null,
				provider_type: activeRun.provider_type,
				action: "sync_run_started",
				result: "info",
				actor_user_id: activeRun.actor_user_id,
				details: {
					provider_type: activeRun.provider_type,
					app_id: activeRun.app_id,
				},
			});

			const summary = await this.runExecutionPlan(activeRun);

			await db
				.updateTable("sync_run")
				.set({
					status: "succeeded",
					completed_at: new Date(),
					error_message: null,
					metadata: {
						...activeRun.metadata,
						summary,
					},
					updated_at: new Date(),
				})
				.where("id", "=", activeRun.id)
				.executeTakeFirstOrThrow();

			await this.appendAuditEvent({
				org_id: activeRun.org_id,
				sync_run_id: activeRun.id,
				app_id: activeRun.app_id,
				env_type_id: null,
				provider_type: activeRun.provider_type,
				action: "sync_run_completed",
				result: "success",
				actor_user_id: activeRun.actor_user_id,
				details: summary,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown enterprise sync failure";

			await db
				.updateTable("sync_run")
				.set({
					status: "failed",
					completed_at: new Date(),
					error_message: message,
					updated_at: new Date(),
				})
				.where("id", "=", activeRun.id)
				.executeTakeFirstOrThrow();

			await this.appendAuditEvent({
				org_id: activeRun.org_id,
				sync_run_id: activeRun.id,
				app_id: activeRun.app_id,
				env_type_id: null,
				provider_type: activeRun.provider_type,
				action: "sync_run_failed",
				result: "error",
				actor_user_id: activeRun.actor_user_id,
				details: {
					error: message,
				},
			});
		}

		return db.selectFrom("sync_run").selectAll().where("id", "=", activeRun.id).executeTakeFirstOrThrow();
	}

	private static async runExecutionPlan(run: SyncRunRow) {
		if (!run.actor_user_id) {
			throw new ValidationError(
				"Enterprise sync runs require actor_user_id so secrets can be read for execution.",
				"ENTERPRISE_SYNC_ACTOR_REQUIRED",
			);
		}

		const db = await DB.getInstance();
		let bindingsQuery = db
			.selectFrom("integration_binding")
			.selectAll()
			.where("org_id", "=", run.org_id)
			.where("provider_type", "=", run.provider_type)
			.where("is_enabled", "=", true);

		if (run.app_id) {
			bindingsQuery = bindingsQuery.where("app_id", "=", run.app_id);
		}

		const bindings = await bindingsQuery.orderBy("created_at", "asc").execute() as BindingRow[];
		if (bindings.length === 0) {
			throw new ValidationError(
				`No enabled ${run.provider_type} bindings are available for this sync run.`,
				"ENTERPRISE_SYNC_BINDINGS_MISSING",
			);
		}

		const bindingIds = bindings.map(binding => binding.id);
		const mappings = await db
			.selectFrom("env_type_mapping")
			.selectAll()
			.where("org_id", "=", run.org_id)
			.where("integration_binding_id", "in", bindingIds)
			.orderBy("created_at", "asc")
			.execute() as MappingRow[];

		if (mappings.length === 0) {
			throw new ValidationError(
				`No env-type mappings are configured for ${run.provider_type}.`,
				"ENTERPRISE_SYNC_MAPPINGS_MISSING",
			);
		}

		const envTypes = await EnvTypeService.getEnvTypes(run.org_id);
		const connections = await db
			.selectFrom("provider_connection")
			.selectAll()
			.where("org_id", "=", run.org_id)
			.where("id", "in", bindings.map(binding => binding.provider_connection_id))
			.execute() as ProviderConnectionRow[];
		const summary = {
			binding_count: bindings.length,
			mapping_count: mappings.length,
			env_type_count: 0,
			env_count: 0,
			secret_count: 0,
			target_count: 0,
			provider_type: run.provider_type,
		};

		for (const binding of bindings) {
			await this.appendAuditEvent({
				org_id: run.org_id,
				sync_run_id: run.id,
				app_id: binding.app_id,
				env_type_id: null,
				provider_type: run.provider_type,
				action: "binding_resolved",
				result: "info",
				actor_user_id: run.actor_user_id,
				details: {
					binding_id: binding.id,
					app_id: binding.app_id,
					provider_connection_id: binding.provider_connection_id,
				},
			});
		}

		for (const mapping of mappings) {
			EnterpriseProviderService.validateMapping({
				provider_type: run.provider_type,
				target_identifier: mapping.target_identifier,
				branch_ref: mapping.branch_ref,
				path_prefix: mapping.path_prefix,
				metadata: mapping.metadata,
			});

			const envType = envTypes.find(entry => entry.id === mapping.env_type_id);
			if (!envType) {
				throw new ValidationError(
					`Environment type ${mapping.env_type_id} is missing for mapping ${mapping.id}.`,
					"ENTERPRISE_SYNC_ENV_TYPE_INVALID",
				);
			}

			const [envs, secrets] = await Promise.all([
				EnvService.getAllEnv({
					org_id: run.org_id,
					app_id: mapping.app_id,
					env_type_id: mapping.env_type_id,
					user_id: run.actor_user_id,
				}),
				SecretService.getAllSecret({
					org_id: run.org_id,
					app_id: mapping.app_id,
					env_type_id: mapping.env_type_id,
					user_id: run.actor_user_id,
				}),
			]);

			const target = EnterpriseProviderService.buildTargetDescriptor({
				provider_type: run.provider_type,
				target_identifier: mapping.target_identifier,
				branch_ref: mapping.branch_ref,
				path_prefix: mapping.path_prefix,
			});

			summary.env_type_count += 1;
			summary.env_count += envs.length;
			summary.secret_count += secrets.length;
			summary.target_count += 1;

			const binding = bindings.find(entry => entry.id === mapping.integration_binding_id);
			if (!binding) {
				throw new ValidationError(
					`Integration binding ${mapping.integration_binding_id} is missing for mapping ${mapping.id}.`,
					"ENTERPRISE_SYNC_BINDING_INVALID",
				);
			}

			const connection = connections.find(entry => entry.id === binding.provider_connection_id);
			if (!connection) {
				throw new ValidationError(
					`Provider connection ${binding.provider_connection_id} is missing for binding ${binding.id}.`,
					"ENTERPRISE_SYNC_CONNECTION_INVALID",
				);
			}

			if (connection.status !== "active") {
				throw new ValidationError(
					`Provider connection ${connection.name} is not active.`,
					"ENTERPRISE_SYNC_CONNECTION_INACTIVE",
				);
			}

			await this.appendAuditEvent({
				org_id: run.org_id,
				sync_run_id: run.id,
				app_id: mapping.app_id,
				env_type_id: mapping.env_type_id,
				provider_type: run.provider_type,
				action: "mapping_validated",
				result: "success",
				actor_user_id: run.actor_user_id,
				details: {
					mapping_id: mapping.id,
					env_type_name: envType.name,
					target,
				},
			});

			await this.appendAuditEvent({
				org_id: run.org_id,
				sync_run_id: run.id,
				app_id: mapping.app_id,
				env_type_id: mapping.env_type_id,
				provider_type: run.provider_type,
				action: "payload_compiled",
				result: "success",
				actor_user_id: run.actor_user_id,
				details: {
					mapping_id: mapping.id,
					env_type_name: envType.name,
					env_count: envs.length,
					secret_count: secrets.length,
				},
			});

			await this.appendAuditEvent({
				org_id: run.org_id,
				sync_run_id: run.id,
				app_id: mapping.app_id,
				env_type_id: mapping.env_type_id,
				provider_type: run.provider_type,
				action: "provider_target_planned",
				result: "info",
				actor_user_id: run.actor_user_id,
				details: {
					mapping_id: mapping.id,
					target,
					binding_id: mapping.integration_binding_id,
				},
			});

			const providerResult = await EnterpriseProviderSyncService.sync({
				org_id: run.org_id,
				app_id: mapping.app_id,
				env_type_id: mapping.env_type_id,
				provider_type: run.provider_type,
				connection: {
					id: connection.id,
					name: connection.name,
					provider_type: connection.provider_type,
					auth_config: connection.auth_config,
					metadata: connection.metadata,
				},
				binding: {
					id: binding.id,
					metadata: binding.metadata,
				},
				mapping: {
					id: mapping.id,
					target_identifier: mapping.target_identifier,
					branch_ref: mapping.branch_ref,
					path_prefix: mapping.path_prefix,
					metadata: mapping.metadata,
				},
				items: [
					...envs.map(entry => ({ key: entry.key, value: entry.value, kind: "env" as const })),
					...secrets.map(entry => ({ key: entry.key, value: entry.value, kind: "secret" as const })),
				],
			});

			await this.appendAuditEvent({
				org_id: run.org_id,
				sync_run_id: run.id,
				app_id: mapping.app_id,
				env_type_id: mapping.env_type_id,
				provider_type: run.provider_type,
				action: "provider_sync_applied",
				result: "success",
				actor_user_id: run.actor_user_id,
				details: {
					mapping_id: mapping.id,
					...providerResult,
				},
			});
		}

		return summary;
	}

	private static async appendAuditEvent(input: {
		org_id: string;
		sync_run_id: string;
		app_id: string | null;
		env_type_id: string | null;
		provider_type: EnterpriseProvider;
		action: string;
		result: "info" | "success" | "error";
		actor_user_id: string | null;
		details: Record<string, unknown>;
	}) {
		const db = await DB.getInstance();
		await db
			.insertInto("sync_audit_event")
			.values({
				id: crypto.randomUUID(),
				org_id: input.org_id,
				sync_run_id: input.sync_run_id,
				app_id: input.app_id,
				env_type_id: input.env_type_id,
				provider_type: input.provider_type,
				action: input.action,
				result: input.result,
				actor_user_id: input.actor_user_id,
				details: input.details,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.executeTakeFirstOrThrow();
	}
}
