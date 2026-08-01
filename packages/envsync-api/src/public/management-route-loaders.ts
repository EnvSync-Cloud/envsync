/**
 * Public route/worker loaders for the management surface.
 * Consumed by `envsync-enterprise` module registry (no relative monorepo paths).
 */
export const managementRouteLoaders = {
	onboarding: async () => (await import("@/routes/onboarding.route")).default,
	license: async () => (await import("@/routes/license.route")).default,
	enterprise: async () => (await import("@/routes/enterprise.route")).default,
	system: async () => (await import("@/routes/system.route")).default,
	oidc: async () => (await import("@/routes/oidc.route")).default,
	saml: async () => (await import("@/routes/saml.route")).default,
	rotation: async () => (await import("@/routes/rotation.route")).default,
	dynamicSecret: async () => (await import("@/routes/dynamic_secret.route")).default,
	logForwarding: async () => (await import("@/routes/log-forwarding.route")).default,
	startLicenseHeartbeat: async () => {
		const { LicenseStateService } = await import("@/services/license-state.service");
		await LicenseStateService.startHeartbeat();
	},
	/**
	 * @deprecated H3: prefer `envsync-enterprise` `startEnterpriseSyncWorker`.
	 * Kept for loaders/tests that still import management-route-loaders.
	 */
	startEnterpriseSync: async () => {
		const { startEnterpriseSyncWorker } = await import("../../../envsync-enterprise/src/background.ts");
		await startEnterpriseSyncWorker();
	},
} as const;
