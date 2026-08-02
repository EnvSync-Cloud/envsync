/**
 * Public license hooks for management/enterprise packages.
 * Prefer this over relative monorepo imports into envsync-api/src.
 */
export async function startLicenseHeartbeat() {
	const { LicenseStateService } = await import("@/services/license-state.service");
	await LicenseStateService.startHeartbeat();
}
