import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { NotFoundError, ConflictError, ValidationError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";

import { getEngine, listEngineTypes } from "./dynamic-secret-engines";

/**
 * Business logic for dynamic secret engines and leases.
 *
 * Engines define how to generate credentials for a target system (Postgres,
 * MySQL, AWS IAM, Azure SP). Leases are the per-app/env bindings that
 * produce actual short-lived credentials.
 */
export class DynamicSecretService {
	// ── Engines ────────────────────────────────────────────────────────────

	public static createEngine = async ({
		org_id,
		engine_type,
		name,
		config,
		enabled = true,
	}: {
		org_id: string;
		engine_type: string;
		name: string;
		config: Record<string, unknown>;
		enabled?: boolean;
	}) => {
		// Validate engine type
		if (!listEngineTypes().includes(engine_type)) {
			throw new ValidationError(`Invalid engine type: ${engine_type}. Must be one of: ${listEngineTypes().join(", ")}`);
		}

		// Validate config through the engine
		const engine = getEngine(engine_type);
		engine.validateConfig(config);

		// Check for duplicate name within org
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("dynamic_secret_engines")
			.select("id")
			.where("org_id", "=", org_id)
			.where("name", "=", name)
			.executeTakeFirst();

		if (existing) {
			throw new ConflictError(`Dynamic secret engine with name "${name}" already exists in this organization`);
		}

		const record = await db
			.insertInto("dynamic_secret_engines")
			.values({
				id: uuidv4(),
				org_id,
				engine_type: engine_type as "postgres" | "mysql" | "aws-iam" | "azure-sp",
				name,
				config,
				enabled,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		infoLogs(
			`Created dynamic secret engine ${record.id} (${engine_type}) for org ${org_id}`,
			LogTypes.LOGS,
			"DynamicSecretService",
		);

		return record;
	};

	public static getEngine = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		const record = await db
			.selectFrom("dynamic_secret_engines")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();

		if (!record) {
			throw new NotFoundError("Dynamic Secret Engine", id);
		}

		return record;
	};

	public static getAllEngines = async (org_id: string) => {
		const db = await DB.getInstance();

		return db
			.selectFrom("dynamic_secret_engines")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.execute();
	};

	public static updateEngine = async ({
		id,
		org_id,
		name,
		config,
		enabled,
	}: {
		id: string;
		org_id: string;
		name?: string;
		config?: Record<string, unknown>;
		enabled?: boolean;
	}) => {
		const db = await DB.getInstance();

		// Verify engine exists and belongs to org
		const existing = await this.getEngine(id, org_id);

		// If config changed, validate it
		if (config) {
			const engine = getEngine(existing.engine_type);
			engine.validateConfig(config);
		}

		// Check name uniqueness if changed
		if (name && name !== existing.name) {
			const duplicate = await db
				.selectFrom("dynamic_secret_engines")
				.select("id")
				.where("org_id", "=", org_id)
				.where("name", "=", name)
				.where("id", "!=", id)
				.executeTakeFirst();

			if (duplicate) {
				throw new ConflictError(`Dynamic secret engine with name "${name}" already exists`);
			}
		}

		const updates: Record<string, unknown> = { updated_at: new Date() };
		if (name !== undefined) updates.name = name;
		if (config !== undefined) updates.config = config;
		if (enabled !== undefined) updates.enabled = enabled;

		const record = await db
			.updateTable("dynamic_secret_engines")
			.set(updates)
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return record;
	};

	public static deleteEngine = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		// Verify exists
		await this.getEngine(id, org_id);

		// Check for active leases
		const activeLeases = await db
			.selectFrom("dynamic_secret_leases")
			.select("id")
			.where("engine_id", "=", id)
			.where("revoked_at", "is", null)
			.where("expires_at", ">", new Date())
			.execute();

		if (activeLeases.length > 0) {
			throw new ConflictError(
				`Cannot delete engine with ${activeLeases.length} active lease(s). Revoke all leases first.`,
			);
		}

		await db
			.deleteFrom("dynamic_secret_engines")
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirstOrThrow();
	};

	// ── Leases ─────────────────────────────────────────────────────────────

	public static createLease = async ({
		engine_id,
		app_id,
		env_type_id,
		variable_key,
		ttl_seconds,
		org_id,
	}: {
		engine_id: string;
		app_id: string;
		env_type_id: string;
		variable_key: string;
		ttl_seconds?: number;
		org_id: string;
	}) => {
		const db = await DB.getInstance();

		// Verify engine exists and belongs to org
		const engineRecord = await this.getEngine(engine_id, org_id);

		if (!engineRecord.enabled) {
			throw new ValidationError("Engine is disabled");
		}

		// Resolve TTL
		const engineConfig = engineRecord.config as Record<string, unknown>;
		const defaultTtl = (engineConfig.default_ttl_seconds as number) ?? 3600;
		const maxTtl = (engineConfig.max_ttl_seconds as number) ?? 86400;
		const resolvedTtl = Math.min(ttl_seconds ?? defaultTtl, maxTtl);

		// Generate credentials through the engine
		const engine = getEngine(engineRecord.engine_type);
		const credentials = await engine.generateCredentials(engineConfig, resolvedTtl);

		const expiresAt = new Date(Date.now() + resolvedTtl * 1000);

		const lease = await db
			.insertInto("dynamic_secret_leases")
			.values({
				id: uuidv4(),
				engine_id,
				app_id,
				env_type_id,
				variable_key,
				credential_data: credentials as Record<string, unknown>,
				expires_at: expiresAt,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		infoLogs(
			`Created lease ${lease.id} for engine ${engine_id}, variable ${variable_key}, expires ${expiresAt.toISOString()}`,
			LogTypes.LOGS,
			"DynamicSecretService",
		);

		return lease;
	};

	public static getLease = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		const lease = await db
			.selectFrom("dynamic_secret_leases")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!lease) {
			throw new NotFoundError("Dynamic Secret Lease", id);
		}

		// Verify the engine belongs to the org
		await this.getEngine(lease.engine_id, org_id);

		return lease;
	};

	public static getLeasesByEngine = async (engine_id: string, org_id: string) => {
		const db = await DB.getInstance();

		// Verify engine belongs to org
		await this.getEngine(engine_id, org_id);

		return db
			.selectFrom("dynamic_secret_leases")
			.selectAll()
			.where("engine_id", "=", engine_id)
			.orderBy("created_at", "desc")
			.execute();
	};

	public static revokeLease = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		// Get lease and verify org ownership
		const lease = await this.getLease(id, org_id);

		if (lease.revoked_at) {
			throw new ConflictError("Lease is already revoked");
		}

		// Attempt to revoke credentials through the engine
		const engineRecord = await this.getEngine(lease.engine_id, org_id);
		const engine = getEngine(engineRecord.engine_type);

		try {
			await engine.revokeCredentials(
				engineRecord.config as Record<string, unknown>,
				lease.credential_data as Record<string, unknown>,
			);
		} catch (err) {
			// Best-effort revocation — log but don't fail the request
			infoLogs(
				`Failed to revoke credentials for lease ${id}: ${err instanceof Error ? err.message : "unknown error"}`,
				LogTypes.ERROR,
				"DynamicSecretService",
			);
		}

		await db
			.updateTable("dynamic_secret_leases")
			.set({ revoked_at: new Date(), updated_at: new Date() })
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		infoLogs(
			`Revoked lease ${id}`,
			LogTypes.LOGS,
			"DynamicSecretService",
		);

		return { id, message: "Lease revoked successfully" };
	};

	/**
	 * Clean up expired leases. Intended for periodic background execution.
	 */
	public static cleanupExpiredLeases = async () => {
		const db = await DB.getInstance();

		const result = await db
			.updateTable("dynamic_secret_leases")
			.set({ revoked_at: new Date(), updated_at: new Date() })
			.where("expires_at", "<=", new Date())
			.where("revoked_at", "is", null)
			.executeTakeFirst();

		infoLogs(
			`Cleaned up ${result.numUpdatedRows} expired leases`,
			LogTypes.LOGS,
			"DynamicSecretService",
		);

		return { cleaned: Number(result.numUpdatedRows) };
	};
}
