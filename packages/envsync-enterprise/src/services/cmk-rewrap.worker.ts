import { sql } from "kysely";

import { DB } from "envsync-api/ports/db";
import { AppError } from "envsync-api/ports/errors";
import { KMSClient } from "envsync-api/ports/kms";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import { CmkService, isNeverAttachedConfig } from "./cmk.service";

type ClaimedJob = {
	id: string;
	org_id: string;
	app_id: string | null;
	kind: "kek_rewrap" | "dek_rewrap" | "detach_managed";
	status: string;
	progress: Record<string, unknown>;
	error_message: string | null;
	created_by: string | null;
};

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isWorkerPassRunning = false;

const WORKER_INTERVAL_MS = 15_000;
/** Crash after claim leaves status=running; reclaim so break-glass can enqueue again. */
const DEFAULT_STALE_RUNNING_MS = 2 * 60 * 60 * 1000;

function isMissingKmsTable(error: unknown): boolean {
	const err = error as { code?: string; message?: string };
	if (err?.code === "42P01") {
		return true;
	}
	const message = err?.message ?? "";
	return /org_kms_(config|rewrap_job)/i.test(message) && /does not exist|undefined_table/i.test(message);
}

export class CmkRewrapWorker {
	public static staleRunningMs = DEFAULT_STALE_RUNNING_MS;

	public static start() {
		if (workerTimer) {
			return;
		}
		workerTimer = setInterval(() => {
			void this.processPendingJobs().catch(error => {
				infoLogs(
					`KMS rewrap worker pass failed: ${error instanceof Error ? error.message : String(error)}`,
					LogTypes.ERROR,
					"CmkRewrapWorker",
				);
			});
		}, WORKER_INTERVAL_MS);
		void this.processPendingJobs().catch(error => {
			infoLogs(
				`Initial KMS rewrap worker pass failed: ${error instanceof Error ? error.message : String(error)}`,
				LogTypes.ERROR,
				"CmkRewrapWorker",
			);
		});
	}

	public static stop() {
		if (workerTimer) {
			clearInterval(workerTimer);
			workerTimer = null;
		}
	}

	public static async reclaimStaleJobs(): Promise<number> {
		try {
			const db = await DB.getInstance();
			const cutoff = new Date(Date.now() - this.staleRunningMs);
			const stale = await db
				.selectFrom("org_kms_rewrap_job")
				.select(["id", "org_id", "kind", "progress"])
				.where("status", "=", "running")
				.where("updated_at", "<", cutoff)
				.execute();
			if (stale.length === 0) {
				return 0;
			}
			const result = await db
				.updateTable("org_kms_rewrap_job")
				.set({
					status: "failed",
					progress: { code: "KMS_JOB_STALE" },
					error_message: "KMS_JOB_STALE: running job exceeded its lease and was reclaimed.",
					updated_at: new Date(),
				})
				.where("id", "in", stale.map(job => job.id))
				.where("status", "=", "running")
				.executeTakeFirst();

			for (const job of stale) {
				if (job.kind === "dek_rewrap") {
					const previous = (job.progress as { previous_status?: string } | null)?.previous_status;
					await CmkService.revertAttachFailure(job.org_id, previous);
					await this.clearAttachDualUnwrap(job.org_id);
				}
			}
			return Number(result.numUpdatedRows ?? 0);
		} catch (error) {
			if (isMissingKmsTable(error)) {
				return 0;
			}
			throw error;
		}
	}

	public static async processPendingJobs(limit = 10): Promise<number> {
		if (isWorkerPassRunning) {
			return 0;
		}
		isWorkerPassRunning = true;
		let processed = 0;
		try {
			await this.reclaimStaleJobs();
			for (let i = 0; i < limit; i++) {
				const claimed = await this.claimNextJob();
				if (!claimed) {
					break;
				}
				await this.executeJob(claimed);
				processed += 1;
			}
		} finally {
			isWorkerPassRunning = false;
		}
		return processed;
	}

	private static async claimNextJob(): Promise<ClaimedJob | null> {
		const db = await DB.getInstance();
		try {
			return await db.transaction().execute(async trx => {
				const result = await sql<ClaimedJob>`
					SELECT id, org_id, app_id, kind, status, progress, error_message, created_by
					FROM org_kms_rewrap_job
					WHERE status = 'pending'
					ORDER BY created_at ASC
					LIMIT 1
					FOR UPDATE SKIP LOCKED
				`.execute(trx);

				const job = result.rows[0];
				if (!job) {
					return null;
				}

				await trx
					.updateTable("org_kms_rewrap_job")
					.set({ status: "running", updated_at: new Date() })
					.where("id", "=", job.id)
					.where("status", "=", "pending")
					.execute();

				return { ...job, status: "running", progress: job.progress ?? {} };
			});
		} catch (error) {
			if (isMissingKmsTable(error)) {
				return null;
			}
			throw error;
		}
	}

	private static async executeJob(job: ClaimedJob): Promise<void> {
		try {
			if (job.kind === "detach_managed") {
				await this.runDetachManaged(job);
				return;
			}
			if (job.kind === "dek_rewrap") {
				await this.runDekRewrap(job);
				return;
			}
			await this.failJob(job.id, "KMS_JOB_UNSUPPORTED", "kek_rewrap is synchronous via POST /rotate-kek.");
		} catch (error) {
			const code = error instanceof AppError ? error.code : "KMS_JOB_FAILED";
			const message = error instanceof Error ? error.message : String(error);
			infoLogs(`kms_dek_rewrap_failed job=${job.id} code=${code}`, LogTypes.ERROR, "CmkRewrapWorker");
			if (job.kind === "dek_rewrap") {
				const previous = (job.progress as { previous_status?: string } | null)?.previous_status;
				await CmkService.revertAttachFailure(job.org_id, previous);
				await this.clearAttachDualUnwrap(job.org_id);
			}
			await this.failJob(job.id, code, message);
		}
	}

	/**
	 * First attach / source change. Dual-unwrap is only while status=rotating.
	 */
	private static async runDekRewrap(job: ClaimedJob): Promise<void> {
		const row = await CmkService.loadRow(job.org_id);
		if (!row || row.source === "managed") {
			await this.succeedJob(job.id, { already_managed: true });
			return;
		}

		const kms = await KMSClient.getInstance();
		if (typeof kms.supportsTenantRewrap === "function" && !kms.supportsTenantRewrap()) {
			await CmkService.revertAttachFailure(
				job.org_id,
				typeof job.progress.previous_status === "string" ? job.progress.previous_status : undefined,
			);
			await this.failJob(
				job.id,
				"CMK_SIDECAR_RPC_UNAVAILABLE",
				"miniKMS sidecar does not support tenant wrapping RPCs. Attach cannot rewrap DEKs.",
			);
			return;
		}

		const { kek, version } = await CmkService.loadMaterializedKek(job.org_id);
		await kms.setTenantWrappingKey({
			tenantId: job.org_id,
			kek,
			kekVersion: version,
			allowRootUnwrap: true,
		});
		await kms.rewrapTenantDataKeys({
			tenantId: job.org_id,
			target: "TENANT_KEK",
			allowRootUnwrap: true,
		});
		await kms.setTenantWrappingKey({
			tenantId: job.org_id,
			kek,
			kekVersion: version,
			allowRootUnwrap: false,
		});

		await CmkService.markAttachSucceeded(job.org_id);
		infoLogs(`kms_dek_rewrap_succeeded job=${job.id} org=${job.org_id} kind=dek_rewrap`, LogTypes.LOGS, "CmkRewrapWorker");
		await this.succeedJob(job.id, { target: "TENANT_KEK", allow_root_unwrap: false });
	}

	/**
	 * Detach / break-glass. Must not call ensureTenantKek when status=unavailable
	 * (that path is 503 by design and would block recovery).
	 */
	private static async runDetachManaged(job: ClaimedJob): Promise<void> {
		const row = await CmkService.loadRow(job.org_id);
		if (!row || row.source === "managed") {
			await this.succeedJob(job.id, { already_managed: true });
			return;
		}

		// Never-attached persist-as-pending has no sidecar KEK. Undo without rewrap.
		if (isNeverAttachedConfig(row)) {
			await CmkService.resetToManaged(job.org_id);
			infoLogs(
				`kms_dek_rewrap_succeeded job=${job.id} org=${job.org_id} kind=detach_managed never_attached=true`,
				LogTypes.LOGS,
				"CmkRewrapWorker",
			);
			await this.succeedJob(job.id, { never_attached: true, skipped_rewrap: true });
			return;
		}

		// Never call ensureTenantKek: unavailable is 503 by design.
		// Healthy detach may warm the sidecar from cloud; break-glass must not.
		const allowWarmup = job.progress.allow_warmup === true && row.status !== "unavailable";
		if (allowWarmup) {
			try {
				await CmkService.warmupSidecarKek(job.org_id);
			} catch (error) {
				infoLogs(
					`kms_detach_warmup_skipped org=${job.org_id} reason=${error instanceof Error ? error.message : String(error)}`,
					LogTypes.ERROR,
					"CmkRewrapWorker",
				);
			}
		}

		const kms = await KMSClient.getInstance();
		if (typeof kms.supportsTenantRewrap === "function" && !kms.supportsTenantRewrap()) {
			await this.failJob(
				job.id,
				"CMK_SIDECAR_RPC_UNAVAILABLE",
				"miniKMS sidecar does not support tenant wrapping RPCs. Break-glass cannot rewrap to root.",
			);
			return;
		}

		try {
			await kms.rewrapTenantDataKeys({
				tenantId: job.org_id,
				target: "ROOT",
				allowRootUnwrap: false,
			});
		} catch (error) {
			if (error instanceof AppError && error.code === "CMK_BREAK_GLASS_KEK_MISSING") {
				await this.failJob(
					job.id,
					"CMK_BREAK_GLASS_KEK_MISSING",
					"Sidecar has no persisted tenant wrapping key. Restore the customer CMK or a miniKMS backup.",
				);
				return;
			}
			if (error instanceof AppError && error.code === "CMK_SIDECAR_RPC_UNAVAILABLE") {
				await this.failJob(
					job.id,
					"CMK_SIDECAR_RPC_UNAVAILABLE",
					"miniKMS sidecar does not support tenant wrapping RPCs. Break-glass cannot rewrap to root.",
				);
				return;
			}
			throw error;
		}

		try {
			await kms.clearTenantWrappingKey(job.org_id);
		} catch (error) {
			if (!(error instanceof AppError && error.code === "CMK_SIDECAR_RPC_UNAVAILABLE")) {
				throw error;
			}
		}

		await CmkService.resetToManaged(job.org_id);
		infoLogs(`kms_dek_rewrap_succeeded job=${job.id} org=${job.org_id} kind=detach_managed`, LogTypes.LOGS, "CmkRewrapWorker");
		await this.succeedJob(job.id, { target: "ROOT" });
	}

	private static async succeedJob(id: string, progress: Record<string, unknown>) {
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_rewrap_job")
			.set({
				status: "succeeded",
				progress,
				error_message: null,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	}

	private static async clearAttachDualUnwrap(orgId: string): Promise<void> {
		try {
			const { kek, version } = await CmkService.loadMaterializedKek(orgId);
			const kms = await KMSClient.getInstance();
			if (typeof kms.supportsTenantRewrap === "function" && !kms.supportsTenantRewrap()) {
				return;
			}
			await kms.setTenantWrappingKey({
				tenantId: orgId,
				kek,
				kekVersion: version,
				allowRootUnwrap: false,
			});
		} catch {
			// Best-effort: attach failed and cloud unwrap may already be gone.
		}
	}

	private static async failJob(id: string, code: string, message: string) {
		const db = await DB.getInstance();
		await db
			.updateTable("org_kms_rewrap_job")
			.set({
				status: "failed",
				progress: { code },
				error_message: `${code}: ${message}`,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	}
}
