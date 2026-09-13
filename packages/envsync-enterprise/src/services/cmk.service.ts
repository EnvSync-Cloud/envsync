import { v4 as uuidv4 } from "uuid";

import { DB } from "envsync-api/ports/db";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "envsync-api/ports/errors";
import { AppService, EditionPolicyService } from "envsync-api/ports/services";
import { KMSClient } from "envsync-api/ports/kms";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import { CmkCredentialService } from "./cmk-credential.service";

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

function hasWrappedKek(value: Buffer | Uint8Array | null | undefined): boolean {
	return Boolean(value && value.length > 0);
}

/** Never-attached: persist-as-pending cloud config with no tenant KEK written yet. */
export function isNeverAttachedConfig(row: {
	source: string;
	status: string;
	wrapped_kek?: Buffer | Uint8Array | null;
} | null | undefined): boolean {
	if (!row || row.source === "managed") {
		return true;
	}
	return row.status === "pending" && !hasWrappedKek(row.wrapped_kek);
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

		// Persist-as-pending until attach (PR-8). Never promote managed→active cloud.
		const now = new Date();
		const db = await DB.getInstance();
		const existing = await this.loadRow(orgId);
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
			throw new AppError(
				"Customer-managed key is unavailable for this organization.",
				503,
				"CMK_UNAVAILABLE",
			);
		}

		// Cloud unwrap + SetTenantWrappingKey is PR-8. Fail closed; do not root-fallback.
		await this.markUnavailable(orgId, "cloud_unwrap_not_implemented");
		infoLogs(`kms_unavailable org=${orgId} reason=cloud_unwrap_not_implemented`, LogTypes.ERROR, "CmkService");
		throw new AppError(
			"Customer-managed key is unavailable for this organization.",
			503,
			"CMK_UNAVAILABLE",
		);
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
			throw new AppError(
				"Customer-managed key is unavailable for this organization.",
				503,
				"CMK_UNAVAILABLE",
			);
		}
		throw new AppError(
			"Cloud CMK verify is not available until Hosted attach (PR-8).",
			501,
			"CMK_CLOUD_NOT_IMPLEMENTED",
		);
	}

	public static async rotateKek(orgId: string): Promise<OrgKmsConfigView> {
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			throw new ValidationError("Managed miniKMS has no customer KEK to rotate.", "CMK_MANAGED_NO_KEK");
		}
		throw new AppError(
			"Cloud KEK rotation is not available until Hosted attach (PR-8).",
			501,
			"CMK_CLOUD_NOT_IMPLEMENTED",
		);
	}

	public static async attach(orgId: string, _createdBy: string): Promise<OrgKmsJobView> {
		await this.assertNoActiveJob(orgId);
		const config = await this.getConfig(orgId);
		if (config.source === "managed") {
			throw new ValidationError("Organization is already on managed wrapping.", "CMK_ALREADY_MANAGED");
		}
		if (!EditionPolicyService.isHosted()) {
			throw new ForbiddenError(
				"Cloud customer-managed keys are only available on Hosted deployments.",
				"CMK_HOSTED_ONLY",
			);
		}
		throw new AppError(
			"Cloud CMK attach is not available until Hosted attach (PR-8).",
			501,
			"CMK_CLOUD_NOT_IMPLEMENTED",
		);
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
