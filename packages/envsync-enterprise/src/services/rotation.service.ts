import { DB } from "@/libs/db";
import { NotFoundError, ConflictError } from "@/libs/errors";
import { smartEncrypt, rsaLayerDecrypt } from "@/helpers/key-store";
import { AppService } from "@/services/app.service";

import { getRotationEngine } from "./rotation-engines";

// --- Types ---------------------------------------------------------------

interface CreatePolicyInput {
	org_id: string;
	app_id: string;
	env_type_id: string;
	variable_key: string;
	engine_type: string;
	schedule_cron: string;
	dual_window_minutes: number;
	enabled: boolean;
	connection_config: Record<string, unknown>;
}

interface UpdatePolicyInput {
	schedule_cron?: string;
	dual_window_minutes?: number;
	enabled?: boolean;
	connection_config?: Record<string, unknown>;
}

// --- Service -------------------------------------------------------------

export class RotationService {
	// ── Policy CRUD ──────────────────────────────────────────────────────

	public static async createPolicy(input: CreatePolicyInput) {
		const db = await DB.getInstance();

		// Prevent duplicate policies for the same variable
		const existing = await db
			.selectFrom("rotation_policies")
			.select("id")
			.where("org_id", "=", input.org_id)
			.where("app_id", "=", input.app_id)
			.where("env_type_id", "=", input.env_type_id)
			.where("variable_key", "=", input.variable_key)
			.executeTakeFirst();

		if (existing) {
			throw new ConflictError(
				`Rotation policy already exists for variable ${input.variable_key} in this environment`,
			);
		}

		// Validate engine config
		const engine = getRotationEngine(input.engine_type);
		engine.validateConfig({ connectionConfig: input.connection_config });

		// Encrypt connection config before storing
		const app = await AppService.getApp({ id: input.app_id });
		if (!app) throw new NotFoundError("App", input.app_id);
		if (app.org_id !== input.org_id) throw new NotFoundError("App", input.app_id);

		const encryptedConfig = smartEncrypt(
			JSON.stringify(input.connection_config),
			app.public_key!,
		);

		const now = new Date();
		const policy = await db
			.insertInto("rotation_policies")
			.values({
				org_id: input.org_id,
				app_id: input.app_id,
				env_type_id: input.env_type_id,
				variable_key: input.variable_key,
				engine_type: input.engine_type as "postgres" | "mysql" | "aws-iam" | "azure-sp" | "gcp-service-account" | "cloudflare-pages" | "sendgrid" | "twilio",
				schedule_cron: input.schedule_cron,
				dual_window_minutes: input.dual_window_minutes,
				enabled: input.enabled,
				created_at: now,
				updated_at: now,
			} as any)
			.returningAll()
			.executeTakeFirstOrThrow();

		return policy;
	}

	public static async getPolicies(
		org_id: string,
		filters?: { app_id?: string; env_type_id?: string; enabled?: boolean },
	) {
		const db = await DB.getInstance();
		let query = db
			.selectFrom("rotation_policies")
			.selectAll()
			.where("org_id", "=", org_id);

		if (filters?.app_id) {
			query = query.where("app_id", "=", filters.app_id);
		}
		if (filters?.env_type_id) {
			query = query.where("env_type_id", "=", filters.env_type_id);
		}
		if (filters?.enabled !== undefined) {
			query = query.where("enabled", "=", filters.enabled);
		}

		return query.orderBy("created_at", "desc").execute();
	}

	public static async getPolicyById(id: string, org_id: string) {
		const db = await DB.getInstance();
		const policy = await db
			.selectFrom("rotation_policies")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirst();

		if (!policy) throw new NotFoundError("RotationPolicy", id);
		return policy;
	}

	public static async updatePolicy(id: string, org_id: string, input: UpdatePolicyInput) {
		const db = await DB.getInstance();

		// Verify exists
		await this.getPolicyById(id, org_id);

		const updates: Record<string, unknown> = { updated_at: new Date() };
		if (input.schedule_cron !== undefined) updates.schedule_cron = input.schedule_cron;
		if (input.dual_window_minutes !== undefined) updates.dual_window_minutes = input.dual_window_minutes;
		if (input.enabled !== undefined) updates.enabled = input.enabled;

		if (input.connection_config !== undefined) {
			const policy = await this.getPolicyById(id, org_id);
			const app = await AppService.getApp({ id: policy.app_id });
			if (!app) throw new NotFoundError("App", policy.app_id);
			updates.connection_config_encrypted = smartEncrypt(
				JSON.stringify(input.connection_config),
				app.public_key!,
			);
		}

		const updated = await db
			.updateTable("rotation_policies")
			.set(updates)
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.returningAll()
			.executeTakeFirstOrThrow();

		return updated;
	}

	public static async deletePolicy(id: string, org_id: string) {
		const db = await DB.getInstance();

		// Verify exists
		await this.getPolicyById(id, org_id);

		await db
			.deleteFrom("rotation_policies")
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.execute();
	}

	// ── Rotation Execution ───────────────────────────────────────────────

	/**
	 * Execute a rotation for the given policy.
	 *
	 * Implements the dual-credential window:
	 * 1. Generate a new credential via the engine
	 * 2. Encrypt and store the new credential as the variable's value
	 * 3. Store both old and new in rotation_state
	 * 4. After dual_window_minutes, the old credential should be revoked
	 */
	public static async executeRotation(policyId: string, org_id: string) {
		const db = await DB.getInstance();
		const policy = await this.getPolicyById(policyId, org_id);

		if (!policy.enabled) {
			throw new ConflictError("Rotation policy is disabled");
		}

		// Get the app for encryption context
		const app = await AppService.getApp({ id: policy.app_id });
		if (!app) throw new NotFoundError("App", policy.app_id);

		// Get the engine
		const engine = getRotationEngine(policy.engine_type);

		// Decrypt connection config
		// In production, this would use KMS to decrypt the stored config
		// For now, we pass it through as the engine will validate

		// Generate new credential
		const result = await engine.generateCredential({
			connectionConfig: {}, // Decrypted config would go here
		});

		// Encrypt the new credential for storage
		const encryptedCredential = smartEncrypt(result.credential, app.public_key!);

		// Store the new credential as the variable value via SecretService
		// This integrates with the existing secret management system
		const { SecretService } = await import("./secret.service");

		// Check if the secret exists
		const existingSecret = await SecretService.getSecret({
			key: policy.variable_key,
			app_id: policy.app_id,
			env_type_id: policy.env_type_id,
			org_id,
			user_id: "system", // System-initiated rotation
		});

		if (existingSecret) {
			await SecretService.updateSecret({
				key: policy.variable_key,
				value: encryptedCredential,
				app_id: policy.app_id,
				env_type_id: policy.env_type_id,
				org_id,
				user_id: "system",
			});
		} else {
			await SecretService.createSecret({
				key: policy.variable_key,
				value: encryptedCredential,
				app_id: policy.app_id,
				env_type_id: policy.env_type_id,
				org_id,
				user_id: "system",
			});
		}

		// Calculate when the old credential expires
		const now = new Date();
		const oldExpiresAt = new Date(now.getTime() + policy.dual_window_minutes * 60 * 1000);

		// Get the previous rotation state to capture old credential
		const previousState = await db
			.selectFrom("rotation_state")
			.selectAll()
			.where("rotation_policy_id", "=", policyId)
			.where("old_credential_revoked", "=", false)
			.orderBy("rotated_at", "desc")
			.executeTakeFirst();

		// Create rotation state record
		const rotationState = await db
			.insertInto("rotation_state")
			.values({
				rotation_policy_id: policyId,
				old_credential_encrypted: previousState?.new_credential_encrypted ?? null,
				new_credential_encrypted: encryptedCredential,
				rotated_at: now,
				old_credential_expires_at: oldExpiresAt,
				old_credential_revoked: false,
				created_at: now,
				updated_at: now,
			} as any)
			.returningAll()
			.executeTakeFirstOrThrow();

		// Update the policy's last_rotated_at and next_rotation_at
		await db
			.updateTable("rotation_policies")
			.set({
				last_rotated_at: now,
				next_rotation_at: this.calculateNextRotation(policy.schedule_cron, now),
				updated_at: now,
			})
			.where("id", "=", policyId)
			.execute();

		return {
			rotation_state_id: rotationState.id,
			new_credential_stored: true,
			old_credential_expires_at: oldExpiresAt.toISOString(),
		};
	}

	// ── Old Credential Revocation ────────────────────────────────────────

	/**
	 * Revoke old credentials that have passed their dual-credential window.
	 * This should be called periodically (e.g., every minute) by a scheduler.
	 */
	public static async revokeExpiredCredentials(org_id?: string) {
		const db = await DB.getInstance();
		const now = new Date();

		// Find all rotation states where old credential has expired but not been revoked
		let query = db
			.selectFrom("rotation_state")
			.innerJoin("rotation_policies", "rotation_policies.id", "rotation_state.rotation_policy_id")
			.select([
				"rotation_state.id as state_id",
				"rotation_state.rotation_policy_id",
				"rotation_state.old_credential_encrypted",
				"rotation_state.old_credential_expires_at",
				"rotation_policies.engine_type",
				"rotation_policies.org_id",
				"rotation_policies.app_id",
			])
			.where("rotation_state.old_credential_revoked", "=", false)
			.where("rotation_state.old_credential_expires_at", "<=", now)
			.where("rotation_state.old_credential_encrypted", "is not", null);

		if (org_id) {
			query = query.where("rotation_policies.org_id", "=", org_id);
		}

		const expiredStates = await query.execute();

		const results = await Promise.allSettled(
			expiredStates.map(async state => {
				try {
					const engine = getRotationEngine(state.engine_type);

					// In production, decrypt the old credential before revoking
					// For now, we pass it through
					await engine.revokeCredential(
						{ connectionConfig: {} },
						state.old_credential_encrypted ?? "",
					);

					// Mark as revoked
					await db
						.updateTable("rotation_state")
						.set({
							old_credential_revoked: true,
							revoked_at: now,
							updated_at: now,
						})
						.where("id", "=", state.state_id)
						.execute();

					return { state_id: state.state_id, revoked: true };
				} catch (error) {
					return {
						state_id: state.state_id,
						revoked: false,
						error: error instanceof Error ? error.message : "Unknown error",
					};
				}
			}),
		);

		return results;
	}

	// ── State Queries ────────────────────────────────────────────────────

	public static async getRotationStates(policyId: string, org_id: string) {
		const db = await DB.getInstance();

		// Verify policy belongs to org
		await this.getPolicyById(policyId, org_id);

		return db
			.selectFrom("rotation_state")
			.selectAll()
			.where("rotation_policy_id", "=", policyId)
			.orderBy("rotated_at", "desc")
			.limit(50)
			.execute();
	}

	public static async getActiveRotationState(policyId: string) {
		const db = await DB.getInstance();
		return db
			.selectFrom("rotation_state")
			.selectAll()
			.where("rotation_policy_id", "=", policyId)
			.where("old_credential_revoked", "=", false)
			.orderBy("rotated_at", "desc")
			.executeTakeFirst();
	}

	// ── Helpers ──────────────────────────────────────────────────────────

	private static calculateNextRotation(cron: string, from: Date): Date {
		// Simple cron parsing for common patterns
		// In production, use a proper cron parser library
		const parts = cron.split(" ");
		if (parts.length !== 5) {
			// Default to 24 hours if cron is unparseable
			return new Date(from.getTime() + 24 * 60 * 60 * 1000);
		}

		const [minute, hour] = parts;
		const next = new Date(from);

		if (minute !== "*") {
			next.setMinutes(parseInt(minute, 10));
		}
		if (hour !== "*") {
			next.setHours(parseInt(hour, 10));
		}

		// If the calculated time is in the past, add a day
		if (next <= from) {
			next.setDate(next.getDate() + 1);
		}

		return next;
	}
}
