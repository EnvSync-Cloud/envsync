/**
 * Enterprise background workers.
 * Owned by envsync-enterprise — no relative monorepo paths into envsync-api/src.
 */
export async function startEnterpriseSyncWorker() {
	const { EnterpriseSyncService } = await import("./services/enterprise-sync.service.ts");
	EnterpriseSyncService.startWorker();
}

/**
 * License heartbeat implementation lives in core (lock middleware); start via
 * public package export only (peer dependency path `envsync-api/license`).
 */
export async function startLicenseHeartbeat() {
	const { startLicenseHeartbeat: start } = await import("envsync-api/license");
	await start();
}
