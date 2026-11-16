import { v4 as uuidv4 } from "uuid";

import { DB } from "envsync-api/ports/db";
import { NotFoundError, ConflictError, ValidationError } from "envsync-api/ports/errors";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import {
	asJsonRecord,
	isCredentialEnvelope,
	openJsonCredential,
	redactSecretFields,
	revealSecrets,
	sealJsonCredential,
	sealPlaintextSecrets,
} from "./credential-envelope";
import { getEngine, listEngineTypes } from "./dynamic-secret-engines";

const ENGINE_SECRET_KEYS = new Set(["password", "secret_access_key", "client_secret"]);

function dynamicEngineAad(orgId: string, engineId: string) {
	return `org:${orgId}:dynamic-secret-engine:${engineId}`;
}

function dynamicLeaseAad(orgId: string, leaseId: string) {
	return `org:${orgId}:dynamic-secret-lease:${leaseId}`;
}

function presentEngine<T extends { config: unknown }>(row: T) {
	return {
		...row,
		config: redactSecretFields(asJsonRecord(row.config), ENGINE_SECRET_KEYS) as Record<string, unknown>,
	};
}

function presentLease<T extends { credential_data: unknown }>(row: T) {
	return {
		...row,
		credential_data: {} as Record<string, unknown>,
	};
}

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

		const id = uuidv4();
		const sealed = await sealPlaintextSecrets(org_id, dynamicEngineAad(org_id, id), config, ENGINE_SECRET_KEYS);
		const record = await db
			.insertInto("dynamic_secret_engines")
			.values({
				id,
				org_id,
				engine_type: engine_type as "postgres" | "mysql",
				name,
				config: sealed.value,
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

		return presentEngine(record);
	};

	private static loadEngine = async (id: string, org_id: string) => {
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

	private static async persistEngineConfig(orgId: string, engineId: string, config: Record<string, unknown>) {
		try {
			const db = await DB.getInstance();
			await db
				.updateTable("dynamic_secret_engines")
				.set({ config, updated_at: new Date() })
				.where("id", "=", engineId)
				.where("org_id", "=", orgId)
				.execute();
		} catch (error) {
			infoLogs(
				`Failed to upgrade dynamic secret engine ${engineId}: ${error instanceof Error ? error.message : "unknown error"}`,
				LogTypes.ERROR,
				"DynamicSecretService",
			);
		}
	}

	private static async ensureEngineSealed(orgId: string, engineId: string, config: unknown) {
		const sealed = await sealPlaintextSecrets(
			orgId,
			dynamicEngineAad(orgId, engineId),
			asJsonRecord(config),
			ENGINE_SECRET_KEYS,
		);
		if (sealed.changed) {
			await this.persistEngineConfig(orgId, engineId, sealed.value);
		}
		return sealed.value;
	}

	private static async engineConfigForUse(orgId: string, engineId: string, config: unknown) {
		const revealed = await revealSecrets(
			orgId,
			dynamicEngineAad(orgId, engineId),
			asJsonRecord(config),
			ENGINE_SECRET_KEYS,
		);
		if (revealed.needsUpgrade) {
			const sealed = await sealPlaintextSecrets(
				orgId,
				dynamicEngineAad(orgId, engineId),
				revealed.value,
				ENGINE_SECRET_KEYS,
			);
			await this.persistEngineConfig(orgId, engineId, sealed.value);
		}
		return revealed.value;
	}

	public static getEngine = async (id: string, org_id: string) => {
		const record = await this.loadEngine(id, org_id);
		const config = await this.ensureEngineSealed(record.org_id, record.id, record.config);
		return presentEngine({ ...record, config });
	};

	public static getAllEngines = async (org_id: string) => {
		const db = await DB.getInstance();
		const rows = await db
			.selectFrom("dynamic_secret_engines")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.execute();
		const presented = [];
		for (const row of rows) {
			const config = await this.ensureEngineSealed(row.org_id, row.id, row.config);
			presented.push(presentEngine({ ...row, config }));
		}
		return presented;
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
		const existing = await this.loadEngine(id, org_id);

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
		if (config !== undefined) {
			const sealed = await sealPlaintextSecrets(org_id, dynamicEngineAad(org_id, id), config, ENGINE_SECRET_KEYS);
			updates.config = sealed.value;
		} else {
			const sealed = await sealPlaintextSecrets(
				org_id,
				dynamicEngineAad(org_id, id),
				asJsonRecord(existing.config),
				ENGINE_SECRET_KEYS,
			);
			if (sealed.changed) updates.config = sealed.value;
		}
		if (enabled !== undefined) updates.enabled = enabled;

		const record = await db
			.updateTable("dynamic_secret_engines")
			.set(updates)
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return presentEngine(record);
	};

	public static deleteEngine = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		// Verify exists
		await this.loadEngine(id, org_id);

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
		const engineRecord = await this.loadEngine(engine_id, org_id);

		if (!engineRecord.enabled) {
			throw new ValidationError("Engine is disabled");
		}

		const engineConfig = await this.engineConfigForUse(org_id, engineRecord.id, engineRecord.config);
		const defaultTtl = (engineConfig.default_ttl_seconds as number) ?? 3600;
		const maxTtl = (engineConfig.max_ttl_seconds as number) ?? 86400;
		const resolvedTtl = Math.min(ttl_seconds ?? defaultTtl, maxTtl);

		// Generate credentials through the engine
		const engine = getEngine(engineRecord.engine_type);
		const credentials = await engine.generateCredentials(engineConfig, resolvedTtl);

		const expiresAt = new Date(Date.now() + resolvedTtl * 1000);
		const leaseId = uuidv4();
		const credential_data = await sealJsonCredential(
			org_id,
			dynamicLeaseAad(org_id, leaseId),
			credentials,
		);

		const lease = await db
			.insertInto("dynamic_secret_leases")
			.values({
				id: leaseId,
				engine_id,
				app_id,
				env_type_id,
				variable_key,
				credential_data,
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

		return presentLease(lease);
	};

	private static loadLease = async (id: string) => {
		const db = await DB.getInstance();
		const lease = await db
			.selectFrom("dynamic_secret_leases")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!lease) {
			throw new NotFoundError("Dynamic Secret Lease", id);
		}
		return lease;
	};

	private static async persistLeaseCredential(leaseId: string, credential: Record<string, unknown>) {
		try {
			const db = await DB.getInstance();
			await db
				.updateTable("dynamic_secret_leases")
				.set({ credential_data: credential, updated_at: new Date() })
				.where("id", "=", leaseId)
				.execute();
		} catch (error) {
			infoLogs(
				`Failed to upgrade dynamic secret lease ${leaseId}: ${error instanceof Error ? error.message : "unknown error"}`,
				LogTypes.ERROR,
				"DynamicSecretService",
			);
		}
	}

	private static storedLeaseCredential(credential: unknown): unknown {
		if (typeof credential !== "string") return credential;
		try {
			return JSON.parse(credential) as unknown;
		} catch {
			return credential;
		}
	}

	private static async ensureLeaseSealed(orgId: string, leaseId: string, credential: unknown) {
		const stored = this.storedLeaseCredential(credential);
		if (isCredentialEnvelope(stored)) return stored;
		const sealed = await sealJsonCredential(orgId, dynamicLeaseAad(orgId, leaseId), asJsonRecord(stored));
		await this.persistLeaseCredential(leaseId, sealed);
		return sealed;
	}

	private static async leaseCredentialForUse(orgId: string, leaseId: string, credential: unknown) {
		const stored = this.storedLeaseCredential(credential);
		if (isCredentialEnvelope(stored)) {
			return asJsonRecord(await openJsonCredential(orgId, dynamicLeaseAad(orgId, leaseId), stored));
		}
		const plain = asJsonRecord(stored);
		const sealed = await sealJsonCredential(orgId, dynamicLeaseAad(orgId, leaseId), plain);
		await this.persistLeaseCredential(leaseId, sealed);
		return plain;
	}

	public static getLease = async (id: string, org_id: string) => {
		const lease = await this.loadLease(id);
		await this.loadEngine(lease.engine_id, org_id);
		const credential_data = await this.ensureLeaseSealed(org_id, lease.id, lease.credential_data);
		return presentLease({ ...lease, credential_data });
	};

	public static getLeasesByEngine = async (engine_id: string, org_id: string) => {
		const db = await DB.getInstance();
		await this.loadEngine(engine_id, org_id);
		const leases = await db
			.selectFrom("dynamic_secret_leases")
			.selectAll()
			.where("engine_id", "=", engine_id)
			.orderBy("created_at", "desc")
			.execute();
		const presented = [];
		for (const lease of leases) {
			const credential_data = await this.ensureLeaseSealed(org_id, lease.id, lease.credential_data);
			presented.push(presentLease({ ...lease, credential_data }));
		}
		return presented;
	};

	public static revokeLease = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		// Get lease and verify org ownership
		const lease = await this.loadLease(id);
		const engineRecord = await this.loadEngine(lease.engine_id, org_id);

		if (lease.revoked_at) {
			throw new ConflictError("Lease is already revoked");
		}

		const credential = await this.leaseCredentialForUse(org_id, lease.id, lease.credential_data);
		const config = await this.engineConfigForUse(org_id, engineRecord.id, engineRecord.config);
		const engine = getEngine(engineRecord.engine_type);

		try {
			await engine.revokeCredentials(config, credential);
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
