import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";

import { DB } from "envsync-api/ports/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "envsync-api/ports/errors";
import { AppService, EditionPolicyService } from "envsync-api/ports/services";
import { KMSClient } from "envsync-api/ports/kms";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import { CmkCloudProvider, sanitizeCloudError } from "./cmk-cloud.provider";
import { CmkCredentialService } from "./cmk-credential.service";

const KEK_BYTES = 32;
const KEK_CACHE_TTL_MS = 5 * 60 * 1000;

type KekCacheEntry = {
	kek: Buffer;
	version: number;
	allowRootUnwrap: boolean;
	expiresAt: number;
};

const kekCache = new Map<string, KekCacheEntry>();

export const KMS_SOURCES = ["managed", "aws-kms", "gcp-kms", "azure-kv"] as const;
export const CLOUD_KMS_SOURCES = ["aws-kms", "gcp-kms", "azure-kv"] as const;
export const KMS_STATUSES = ["active", "pending", "rotating", "unavailable", "disabled"] as const;

export type KmsSource = (typeof KMS_SOURCES)[number];
export type CloudKmsSource = (typeof CLOUD_KMS_SOURCES)[number];
export type KmsStatus = (typeof KMS_STATUSES)[number];
export type KmsJobKind = "kek_rewrap" | "dek_rewrap" | "detach_managed";
export type KmsJobStatus = "pending" | "running" | "succeeded" | "failed";

export type OrgKmsConfigView = {
	org_id: string;
	source: KmsSource;
	status: KmsStatus;
	key_ref: string | null;
	region: string | null;
	credential_secret_id: string | null;
	kek_version: number;
	last_verified_at: string | null;
	last_error: string | null;
	implicit: boolean;
};

export type OrgKmsJobView = {
	id: string;
	org_id: string;
	app_id: string | null;
	kind: KmsJobKind;
	status: KmsJobStatus;
	progress: Record<string, unknown>;
	error_message: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
};

export type OrgKmsAppKeyInfo = {
	app_id: string;
	name: string;
	key_version_id: string | null;
	version: number | null;
	encryption_count: number | null;
	max_encryptions: number | null;
	status: string;
};

function toIso(value: Date | string | null | undefined): string | null {
	if (!value) {
		return null;
	}
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function isCloudSource(source: string): source is CloudKmsSource {
	return (CLOUD_KMS_SOURCES as readonly string[]).includes(source);
}

function unavailableError() {
	return new AppError(
		"Customer-managed key is unavailable for this organization.",
		503,
		"CMK_UNAVAILABLE",
	);
}

function hasWrappedKek(value: Buffer | Uint8Array | null | undefined): boolean {
	return Boolean(value && value.length > 0);
}

/**
 * Never-attached: cloud config that has not finished DEK rewrap.
 * `verify` may first-wrap a KEK while status stays pending; DEKs are still root.
 */
export function isNeverAttachedConfig(row: {
	source: string;
	status: string;
	wrapped_kek?: Buffer | Uint8Array | null;
} | null | undefined): boolean {
	if (!row || row.source === "managed") {
		return true;
	}
	return row.status === "pending";
}

function isKmsStatus(value: string | undefined): value is KmsStatus {
	return Boolean(value && (KMS_STATUSES as readonly string[]).includes(value));
}

/**
 * Cloud PUT must not brick a managed org (keep pending) or fail-open an
 * unavailable attached org (keep unavailable). Preserve active/rotating only
 * for same-source metadata updates after attach.
 */
export function nextCloudPutStatus(
	existing: { source: string; status: string } | undefined,
	nextSource: KmsSource,
): KmsStatus {
	if (!existing || existing.source === "managed") {
		return "pending";
	}
	if (existing.status === "unavailable" || existing.status === "disabled") {
		return existing.status;
	}
	if (existing.status === "pending") {
		return "pending";
	}
	if (
		(existing.status === "active" || existing.status === "rotating")
		&& existing.source === nextSource
	) {
		return existing.status;
	}
	return "pending";
}

function isMissingKmsTable(error: unknown): boolean {
	const err = error as { code?: string; message?: string };
	if (err?.code === "42P01") {
		return true;
	}
	const message = err?.message ?? "";
	return /org_kms_(config|rewrap_job)/i.test(message) && /does not exist|undefined_table/i.test(message);
}

function implicitManaged(orgId: string): OrgKmsConfigView {
	return {
		org_id: orgId,
		source: "managed",
		status: "active",
		key_ref: null,
		region: null,
		credential_secret_id: null,
		kek_version: 1,
		last_verified_at: null,
		last_error: null,
		implicit: true,
	};
}

function mapConfigRow(row: {
	org_id: string;
	source: string;
	status: string;
	key_ref?: string | null;
	region?: string | null;
	credential_secret_id?: string | null;
	kek_version: number;
	last_verified_at?: Date | string | null;
	last_error?: string | null;
}): OrgKmsConfigView {
	return {
		org_id: row.org_id,
		source: row.source as KmsSource,
		status: row.status as KmsStatus,
		key_ref: row.key_ref ?? null,
		region: row.region ?? null,
		credential_secret_id: row.credential_secret_id ?? null,
		kek_version: row.kek_version,
		last_verified_at: toIso(row.last_verified_at),
		last_error: row.last_error ?? null,
		implicit: false,
	};
}

function mapJobRow(row: {
	id: string;
	org_id: string;
	app_id?: string | null;
	kind: string;
	status: string;
	progress: Record<string, unknown>;
	error_message?: string | null;
	created_by?: string | null;
	created_at: Date | string;
	updated_at: Date | string;
}): OrgKmsJobView {
	return {
		id: row.id,
		org_id: row.org_id,
		app_id: row.app_id ?? null,
		kind: row.kind as KmsJobKind,
		status: row.status as KmsJobStatus,
		progress: row.progress ?? {},
		error_message: row.error_message ?? null,
		created_by: row.created_by ?? null,
		created_at: toIso(row.created_at) ?? new Date().toISOString(),
		updated_at: toIso(row.updated_at) ?? new Date().toISOString(),
	};
}

export function registerCmkTenantWrappingProvider() {
	KMSClient.setTenantWrappingProvider(async ({ orgId }) => {
		await CmkService.ensureTenantKek(orgId);
	});
}

export class CmkService {
	public static async getConfig(orgId: string): Promise<OrgKmsConfigView> {
		const row = await this.loadRow(orgId);
		return row ? mapConfigRow(row) : implicitManaged(orgId);
	}

	public static async getStatusView(orgId: string) {
		const config = await this.getConfig(orgId);
		const credentials = await CmkCredentialService.list(orgId);
		return { ...config, credentials };
	}

	public static async updateConfig(
		orgId: string,
		input: {
			source: KmsSource;
			key_ref?: string | null;
			region?: string | null;
			credential_secret_id?: string | null;
		},
	): Promise<OrgKmsConfigView> {
		await this.assertNoActiveJob(orgId);

		if (input.source === "managed") {
			return this.upsertManaged(orgId);
		}

		if (!EditionPolicyService.isHosted()) {
			throw new ForbiddenError(
				"Cloud customer-managed keys are only available on Hosted deployments.",
				"CMK_HOSTED_ONLY",
			);
		}

		if (input.credential_secret_id) {
			await CmkCredentialService.getForOrg(orgId, input.credential_secret_id);
		}

		// Persist-as-pending until attach. Never promote managed→active cloud.
		const now = new Date();
		const db = await DB.getInstance();
		const existing = await this.loadRow(orgId);
		if (
			existing
			&& isCloudSource(existing.source)
			&& existing.source !== input.source
			&& !isNeverAttachedConfig(existing)
		) {
			throw new ValidationError("Detach to managed before changing cloud KMS source.", "CMK_DETACH_REQUIRED");
		}
		if (
			existing
			&& (existing.status === "active" || existing.status === "rotating")
			&& existing.source === input.source
		) {
			const nextRef = input.key_ref === undefined ? existing.key_ref : input.key_ref;
			if ((nextRef ?? null) !== (existing.key_ref ?? null)) {
				throw new ValidationError(
					"Rotate the KEK before changing key_ref on an attached CMK.",
					"CMK_ROTATE_KEK_REQUIRED",
				);
			}
		}
		const nextStatus = nextCloudPutStatus(existing, input.source);
		if (existing) {
			await db
				.updateTable("org_kms_config")
				.set({
					source: input.source,
					status: nextStatus,
					key_ref: input.key_ref ?? null,
					region: input.region ?? null,
					credential_secret_id: input.credential_secret_id ?? null,
					updated_at: now,
				})
				.where("org_id", "=", orgId)
				.execute();
		} else {
			await db
				.insertInto("org_kms_config")
				.values({
					org_id: orgId,
					source: input.source,
					status: "pending",
					key_ref: input.key_ref ?? null,
					region: input.region ?? null,
					credential_secret_id: input.credential_secret_id ?? null,
					wrapped_kek: null,
					kek_version: 1,
					last_verified_at: null,
					last_error: null,
					created_at: now,
					updated_at: now,
				})
				.execute();
		}

		infoLogs(`kms_source_changed org=${orgId} source=${input.source}`, LogTypes.LOGS, "CmkService");
		return this.getConfig(orgId);
	}

	public static clearKekCache(orgId?: string): void {
		if (orgId) {
			kekCache.delete(orgId);
			return;
		}
		kekCache.clear();
	}

	/**
	 * Called on every tenant miniKMS op (except `__kms_config__`).
	 * Does not check the `kms` entitlement — losing the SKU must not brick unwrap.
	 */
	public static async ensureTenantKek(orgId: string): Promise<void> {
		const row = await this.loadRow(orgId);
		if (!row || row.source === "managed") {
			return;
		}
		if (row.status === "pending" || row.status === "disabled") {
			return;
		}
		if (row.status === "unavailable") {
			throw unavailableError();
		}

		const allowRootUnwrap = row.status === "rotating";
		try {
			// Fail closed on active unwrap. Do not fall back to MINIKMS_ROOT_KEY.
			await this.setSidecarKek(row, {
				allowRootUnwrap,
				markUnavailableOnFail: row.status === "active",
			});
		} catch (error) {
			if (row.status === "rotating") {
				// Attach worker already persisted the KEK + dual-unwrap on the sidecar.
				infoLogs(
					`kms_unwrap org=${orgId} source=${row.source} ok=false rotating_continue`,
					LogTypes.ERROR,
					"CmkService",
				);
				return;
			}
			throw error;
		}
	}

	public static async markUnavailable(orgId: string, lastError: string): Promise<void> {
		try {
			const db = await DB.getInstance();
			await db
				.updateTable("org_kms_config")
				.set({
					status: "unavailable",
					last_error: lastError,
					updated_at: new Date(),
				})
				.where("org_id", "=", orgId)
				.where("source", "!=", "managed")
				.execute();
		} catch (error) {
			if (isMissingKmsTable(error)) {
				return;
			}
			throw error;
		}
	}

	public static async verify(orgId: string) {
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			const now = new Date();
			if (!config.implicit) {
				const db = await DB.getInstance();
				await db
					.updateTable("org_kms_config")
					.set({ last_verified_at: now, last_error: null, updated_at: now })
					.where("org_id", "=", orgId)
					.execute();
			}
			infoLogs(`kms_verify org=${orgId} source=managed ok=true`, LogTypes.LOGS, "CmkService");
			return { ok: true, source: config.source, status: config.status, last_verified_at: now.toISOString() };
		}
		if (config.status === "unavailable") {
			throw unavailableError();
		}
		this.assertHostedCloud();
		try {
			const row = await this.requireCloudRow(orgId);
			if (hasWrappedKek(row.wrapped_kek)) {
				await this.unwrapCloudKek(row);
			} else {
				await this.firstWrapKek(orgId);
			}
		} catch (error) {
			if (config.status === "active") {
				await this.markUnavailable(orgId, sanitizeCloudError(error));
				infoLogs(`kms_unavailable org=${orgId} reason=verify_failed`, LogTypes.ERROR, "CmkService");
				throw unavailableError();
			}
			throw error;
		}
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({ last_verified_at: now, last_error: null, updated_at: now })
			.where("org_id", "=", orgId)
			.execute();
		const updated = await this.getConfig(orgId);
		infoLogs(`kms_verify org=${orgId} source=${updated.source} ok=true`, LogTypes.LOGS, "CmkService");
		return {
			ok: true,
			source: updated.source,
			status: updated.status,
			last_verified_at: updated.last_verified_at ?? now.toISOString(),
		};
	}

	public static async rotateKek(orgId: string): Promise<OrgKmsConfigView> {
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			throw new ValidationError("Managed miniKMS has no customer KEK to rotate.", "CMK_MANAGED_NO_KEK");
		}
		if (config.status === "unavailable") {
			throw unavailableError();
		}
		this.assertHostedCloud();
		const row = await this.requireCloudRow(orgId);
		const kek = await this.unwrapCloudKek(row);
		const wrapped = await this.wrapCloudKek(row, kek);
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({
				wrapped_kek: wrapped,
				last_verified_at: now,
				last_error: null,
				updated_at: now,
			})
			.where("org_id", "=", orgId)
			.execute();
		this.clearKekCache(orgId);
		infoLogs(`kms_kek_rotated org=${orgId} source=${row.source}`, LogTypes.LOGS, "CmkService");
		return this.getConfig(orgId);
	}

	public static async attach(orgId: string, createdBy: string): Promise<OrgKmsJobView> {
		await this.assertNoActiveJob(orgId);
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			throw new ValidationError("Organization is already on managed wrapping.", "CMK_ALREADY_MANAGED");
		}
		this.assertHostedCloud();
		const row = await this.requireCloudRow(orgId);
		if (!hasWrappedKek(row.wrapped_kek)) {
			await this.firstWrapKek(orgId);
		}
		const now = new Date();
		const jobRow = {
			id: uuidv4(),
			org_id: orgId,
			app_id: null,
			kind: "dek_rewrap" as const,
			status: "pending" as const,
			progress: {
				allow_root_unwrap: true,
				previous_status: config.status,
				target: "TENANT_KEK",
			},
			error_message: null,
			created_by: createdBy,
			created_at: now,
			updated_at: now,
		};
		const db = await DB.getInstance();
		try {
			// Same txn: never leave status=rotating without a job row.
			await db.transaction().execute(async trx => {
				await trx
					.updateTable("org_kms_config")
					.set({ status: "rotating", last_error: null, updated_at: now })
					.where("org_id", "=", orgId)
					.execute();
				await trx.insertInto("org_kms_rewrap_job").values(jobRow).execute();
			});
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code === "23505") {
				throw new ConflictError("A KMS rewrap job is already in progress for this organization.", "KMS_JOB_IN_PROGRESS");
			}
			throw error;
		}
		infoLogs(`kms_dek_rewrap_enqueued org=${orgId} kind=dek_rewrap job=${jobRow.id}`, LogTypes.LOGS, "CmkService");
		return mapJobRow(jobRow);
	}

	public static async detach(orgId: string, createdBy: string): Promise<OrgKmsJobView> {
		await this.assertNoActiveJob(orgId);
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			throw new ValidationError("Organization is already on managed wrapping.", "CMK_ALREADY_MANAGED");
		}
		return this.enqueueJob(orgId, "detach_managed", createdBy, {
			allow_warmup: config.status !== "unavailable",
		});
	}

	public static async breakGlassDetach(orgId: string, createdBy = "platform"): Promise<OrgKmsJobView> {
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			return {
				id: "already-managed",
				org_id: orgId,
				app_id: null,
				kind: "detach_managed",
				status: "succeeded",
				progress: { already_managed: true },
				error_message: null,
				created_by: createdBy,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			};
		}
		await this.assertNoActiveJob(orgId);
		infoLogs(`kms_break_glass_detach org=${orgId}`, LogTypes.LOGS, "CmkService");
		return this.enqueueJob(orgId, "detach_managed", createdBy, { allow_warmup: false });
	}

	public static async getJob(orgId: string, jobId: string): Promise<OrgKmsJobView> {
		const db = await DB.getInstance();
		try {
			const row = await db
				.selectFrom("org_kms_rewrap_job")
				.selectAll()
				.where("id", "=", jobId)
				.where("org_id", "=", orgId)
				.executeTakeFirst();
			if (!row) {
				throw new NotFoundError("KmsJob", jobId);
			}
			return mapJobRow(row);
		} catch (error) {
			if (isMissingKmsTable(error)) {
				throw new NotFoundError("KmsJob", jobId);
			}
			throw error;
		}
	}

	public static async listApps(orgId: string): Promise<OrgKmsAppKeyInfo[]> {
		await this.ensureTenantKek(orgId);
		const apps = await AppService.getAllApps(orgId);
		const kms = await KMSClient.getInstance();
		return Promise.all(
			apps.map(async app => {
				try {
					const info = await kms.getKeyInfo(orgId, app.id);
					return {
						app_id: app.id,
						name: app.name,
						key_version_id: info.keyVersionId,
						version: info.version,
						encryption_count: info.encryptionCount,
						max_encryptions: info.maxEncryptions,
						status: info.status,
					};
				} catch {
					return {
						app_id: app.id,
						name: app.name,
						key_version_id: null,
						version: null,
						encryption_count: null,
						max_encryptions: null,
						status: "none",
					};
				}
			}),
		);
	}

	public static async resetToManaged(orgId: string): Promise<void> {
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({
				source: "managed",
				status: "active",
				key_ref: null,
				region: null,
				credential_secret_id: null,
				wrapped_kek: null,
				last_error: null,
				updated_at: now,
			})
			.where("org_id", "=", orgId)
			.execute();
		this.clearKekCache(orgId);
	}

	public static async loadMaterializedKek(orgId: string): Promise<{ kek: Buffer; version: number }> {
		const row = await this.requireCloudRow(orgId);
		const kek = hasWrappedKek(row.wrapped_kek) ? await this.unwrapCloudKek(row) : await this.firstWrapKek(orgId);
		return { kek, version: row.kek_version };
	}

	/** Healthy detach only: refresh sidecar from cloud. Never used when status=unavailable. */
	public static async warmupSidecarKek(orgId: string): Promise<void> {
		const row = await this.requireCloudRow(orgId);
		await this.setSidecarKek(row, { allowRootUnwrap: false, markUnavailableOnFail: false });
	}

	public static async markAttachSucceeded(orgId: string): Promise<void> {
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({
				status: "active",
				last_error: null,
				last_verified_at: now,
				updated_at: now,
			})
			.where("org_id", "=", orgId)
			.execute();
		this.clearKekCache(orgId);
	}

	public static async revertAttachFailure(orgId: string, previousStatus?: string): Promise<void> {
		const row = await this.loadRow(orgId);
		if (!row || row.source === "managed" || row.status !== "rotating") {
			return;
		}
		// Preserve unavailable (fail-closed). Only invent pending when previous is missing/unknown/rotating.
		const nextStatus: KmsStatus =
			isKmsStatus(previousStatus) && previousStatus !== "rotating" ? previousStatus : "pending";
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({ status: nextStatus, updated_at: now })
			.where("org_id", "=", orgId)
			.where("status", "=", "rotating")
			.execute();
		this.clearKekCache(orgId);
	}

	public static async loadRow(orgId: string) {
		try {
			const db = await DB.getInstance();
			return await db.selectFrom("org_kms_config").selectAll().where("org_id", "=", orgId).executeTakeFirst();
		} catch (error) {
			if (isMissingKmsTable(error)) {
				return undefined;
			}
			throw error;
		}
	}

	private static assertHostedCloud() {
		if (!EditionPolicyService.isHosted()) {
			throw new ForbiddenError(
				"Cloud customer-managed keys are only available on Hosted deployments.",
				"CMK_HOSTED_ONLY",
			);
		}
	}

	private static async requireCloudRow(orgId: string) {
		const row = await this.loadRow(orgId);
		if (!row || !isCloudSource(row.source)) {
			throw new ValidationError("Organization is already on managed wrapping.", "CMK_ALREADY_MANAGED");
		}
		if (!row.key_ref) {
			throw new ValidationError("Cloud KMS key_ref is required.", "CMK_KEY_REF_REQUIRED");
		}
		if (!row.credential_secret_id) {
			throw new ValidationError("Cloud KMS credential is required.", "CMK_CREDENTIAL_REQUIRED");
		}
		return row as typeof row & { source: CloudKmsSource; key_ref: string; credential_secret_id: string };
	}

	private static async wrapCloudKek(
		row: { org_id: string; source: CloudKmsSource; key_ref: string; region?: string | null; credential_secret_id: string },
		kek: Buffer,
	): Promise<Buffer> {
		const credentials = await CmkCredentialService.decryptValue(row.org_id, row.credential_secret_id);
		return CmkCloudProvider.wrap({
			source: row.source,
			keyRef: row.key_ref,
			region: row.region,
			credentials,
			plaintext: kek,
		});
	}

	private static async unwrapCloudKek(row: {
		org_id: string;
		source: CloudKmsSource;
		key_ref: string;
		region?: string | null;
		credential_secret_id: string;
		wrapped_kek?: Buffer | Uint8Array | null;
	}): Promise<Buffer> {
		if (!hasWrappedKek(row.wrapped_kek)) {
			throw new ValidationError("Tenant KEK has not been wrapped yet.", "CMK_KEK_NOT_WRAPPED");
		}
		const credentials = await CmkCredentialService.decryptValue(row.org_id, row.credential_secret_id);
		return CmkCloudProvider.unwrap({
			source: row.source,
			keyRef: row.key_ref,
			region: row.region,
			credentials,
			ciphertext: Buffer.from(row.wrapped_kek as Buffer),
		});
	}

	private static async firstWrapKek(orgId: string): Promise<Buffer> {
		const row = await this.requireCloudRow(orgId);
		if (hasWrappedKek(row.wrapped_kek)) {
			return this.unwrapCloudKek(row);
		}
		const kek = randomBytes(KEK_BYTES);
		const wrapped = await this.wrapCloudKek(row, kek);
		const now = new Date();
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_config")
			.set({
				wrapped_kek: wrapped,
				last_verified_at: now,
				last_error: null,
				updated_at: now,
			})
			.where("org_id", "=", orgId)
			.execute();
		return kek;
	}

	private static async setSidecarKek(
		row: {
			org_id: string;
			source: string;
			status: string;
			key_ref?: string | null;
			region?: string | null;
			credential_secret_id?: string | null;
			wrapped_kek?: Buffer | Uint8Array | null;
			kek_version: number;
		},
		opts: { allowRootUnwrap: boolean; markUnavailableOnFail: boolean },
	): Promise<Buffer> {
		const cached = kekCache.get(row.org_id);
		if (
			cached
			&& cached.version === row.kek_version
			&& cached.allowRootUnwrap === opts.allowRootUnwrap
			&& cached.expiresAt > Date.now()
		) {
			return cached.kek;
		}

		try {
			if (!isCloudSource(row.source) || !row.key_ref || !row.credential_secret_id) {
				throw new ValidationError("Cloud KMS configuration is incomplete.", "CMK_ATTACH_INCOMPLETE");
			}
			const kek = await this.unwrapCloudKek({
				org_id: row.org_id,
				source: row.source,
				key_ref: row.key_ref,
				region: row.region,
				credential_secret_id: row.credential_secret_id,
				wrapped_kek: row.wrapped_kek,
			});
			const kms = await KMSClient.getInstance();
			await kms.setTenantWrappingKey({
				tenantId: row.org_id,
				kek,
				kekVersion: row.kek_version,
				allowRootUnwrap: opts.allowRootUnwrap,
			});
			kekCache.set(row.org_id, {
				kek,
				version: row.kek_version,
				allowRootUnwrap: opts.allowRootUnwrap,
				expiresAt: Date.now() + KEK_CACHE_TTL_MS,
			});
			infoLogs(`kms_unwrap org=${row.org_id} source=${row.source} ok=true`, LogTypes.LOGS, "CmkService");
			return kek;
		} catch (error) {
			kekCache.delete(row.org_id);
			if (opts.markUnavailableOnFail) {
				await this.markUnavailable(row.org_id, sanitizeCloudError(error));
				infoLogs(
					`kms_unavailable org=${row.org_id} reason=${sanitizeCloudError(error)}`,
					LogTypes.ERROR,
					"CmkService",
				);
				throw unavailableError();
			}
			throw error;
		}
	}

	private static async upsertManaged(orgId: string): Promise<OrgKmsConfigView> {
		const now = new Date();
		const db = await DB.getInstance();
		const existing = await this.loadRow(orgId);
		if (existing) {
			if (existing.source !== "managed" && !isNeverAttachedConfig(existing)) {
				throw new ValidationError("Detach to managed before clearing a cloud source.", "CMK_DETACH_REQUIRED");
			}
			await db
				.updateTable("org_kms_config")
				.set({
					source: "managed",
					status: "active",
					key_ref: null,
					region: null,
					credential_secret_id: null,
					wrapped_kek: null,
					last_error: null,
					updated_at: now,
				})
				.where("org_id", "=", orgId)
				.execute();
			this.clearKekCache(orgId);
		} else {
			await db
				.insertInto("org_kms_config")
				.values({
					org_id: orgId,
					source: "managed",
					status: "active",
					key_ref: null,
					region: null,
					credential_secret_id: null,
					wrapped_kek: null,
					kek_version: 1,
					last_verified_at: null,
					last_error: null,
					created_at: now,
					updated_at: now,
				})
				.execute();
		}
		return this.getConfig(orgId);
	}

	private static async assertNoActiveJob(orgId: string) {
		const { CmkRewrapWorker } = await import("./cmk-rewrap.worker");
		await CmkRewrapWorker.reclaimStaleJobs();
		const db = await DB.getInstance();
		try {
			const active = await db
				.selectFrom("org_kms_rewrap_job")
				.select("id")
				.where("org_id", "=", orgId)
				.where("status", "in", ["pending", "running"])
				.executeTakeFirst();
			if (active) {
				throw new ConflictError("A KMS rewrap job is already in progress for this organization.", "KMS_JOB_IN_PROGRESS");
			}
		} catch (error) {
			if (error instanceof ConflictError) {
				throw error;
			}
			if (isMissingKmsTable(error)) {
				return;
			}
			throw error;
		}
	}

	private static async enqueueJob(
		orgId: string,
		kind: KmsJobKind,
		createdBy: string,
		progress: Record<string, unknown>,
	): Promise<OrgKmsJobView> {
		const db = await DB.getInstance();
		const now = new Date();
		const row = {
			id: uuidv4(),
			org_id: orgId,
			app_id: null,
			kind,
			status: "pending" as const,
			progress,
			error_message: null,
			created_by: createdBy,
			created_at: now,
			updated_at: now,
		};
		try {
			await db.insertInto("org_kms_rewrap_job").values(row).execute();
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code === "23505") {
				throw new ConflictError("A KMS rewrap job is already in progress for this organization.", "KMS_JOB_IN_PROGRESS");
			}
			throw error;
		}
		infoLogs(`kms_dek_rewrap_enqueued org=${orgId} kind=${kind} job=${row.id}`, LogTypes.LOGS, "CmkService");
		return mapJobRow(row);
	}
}
