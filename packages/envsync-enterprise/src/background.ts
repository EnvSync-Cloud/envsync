/**
 * Enterprise background workers (H3).
 * Owned by envsync-enterprise; management modules should prefer these entrypoints.
 */

export async function startEnterpriseSyncWorker() {
	const { EnterpriseSyncService } = await import("./services/enterprise-sync.service.ts");
	EnterpriseSyncService.startWorker();
}

/** License heartbeat stays implemented in envsync-api (shared lock middleware). */
export async function startLicenseHeartbeat() {
	const { LicenseStateService } = await import("../../envsync-api/src/services/license-state.service.ts");
	await LicenseStateService.startHeartbeat();
}
