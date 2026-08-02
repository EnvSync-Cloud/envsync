/**
 * Shared (core) route loaders still used by management surface.
 *
 * P1: EE modules (license, enterprise, oidc, saml, rotation, dynamic_secret,
 * log_forwarding) live in `envsync-enterprise` and are registered via
 * `enterpriseManagementModules` — they are no longer loaded from core.
 */
export const managementRouteLoaders = {
	onboarding: async () => (await import("@/routes/onboarding.route")).default,
	system: async () => (await import("@/routes/system.route")).default,
	startLicenseHeartbeat: async () => {
		const { startLicenseHeartbeat } = await import("./license");
		await startLicenseHeartbeat();
	},
} as const;
