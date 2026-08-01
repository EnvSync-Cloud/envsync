import type { ApiModule } from "envsync-kernel";

import { startEnterpriseSyncWorker, startLicenseHeartbeat } from "./background";

/**
 * Canonical management / enterprise API module surface.
 *
 * P1: EE routes/controllers/validators are owned by this package (not envsync-api loaders).
 * Shared core routes (onboarding, system) still load from envsync-api public surface.
 */
async function loadCoreOnboarding() {
	const { managementRouteLoaders } = await import("envsync-api/management-route-loaders");
	return managementRouteLoaders.onboarding();
}

async function loadCoreSystem() {
	const { managementRouteLoaders } = await import("envsync-api/management-route-loaders");
	return managementRouteLoaders.system();
}

export const enterpriseManagementModules: ApiModule[] = [
	{
		name: "onboarding",
		mountPath: "/onboarding",
		createRouter: loadCoreOnboarding,
	},
	{
		name: "license",
		mountPath: "/license",
		createRouter: async () => (await import("./routes/license.route")).default,
		registerBackgroundHandlers: startLicenseHeartbeat,
	},
	{
		name: "enterprise",
		mountPath: "/enterprise",
		createRouter: async () => (await import("./routes/enterprise.route")).default,
		registerBackgroundHandlers: startEnterpriseSyncWorker,
	},
	{
		name: "system",
		mountPath: "/system",
		createRouter: loadCoreSystem,
	},
	{
		name: "oidc",
		mountPath: "/oidc",
		createRouter: async () => (await import("./routes/oidc.route")).default,
	},
	{
		name: "saml",
		mountPath: "/saml",
		createRouter: async () => (await import("./routes/saml.route")).default,
	},
	{
		name: "rotation",
		mountPath: "/rotation",
		createRouter: async () => (await import("./routes/rotation.route")).default,
	},
	{
		name: "dynamic_secret",
		mountPath: "/dynamic_secret",
		createRouter: async () => (await import("./routes/dynamic_secret.route")).default,
	},
	{
		name: "log_forwarding",
		mountPath: "/log_forwarding",
		createRouter: async () => (await import("./routes/log-forwarding.route")).default,
	},
];
