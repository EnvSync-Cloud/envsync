import type { ApiModule } from "./types";

export const managementApiModules: ApiModule[] = [
	{
		name: "onboarding",
		mountPath: "/onboarding",
		createRouter: async () => (await import("@/routes/onboarding.route")).default,
	},
	{
		name: "license",
		mountPath: "/license",
		createRouter: async () => (await import("@/routes/license.route")).default,
		registerBackgroundHandlers: async () => {
			const { LicenseStateService } = await import("@/services/license-state.service");
			await LicenseStateService.startHeartbeat();
		},
	},
	{
		name: "enterprise",
		mountPath: "/enterprise",
		createRouter: async () => (await import("@/routes/enterprise.route")).default,
		registerBackgroundHandlers: async () => {
			const { EnterpriseSyncService } = await import("@/services/enterprise-sync.service");
			EnterpriseSyncService.startWorker();
		},
	},
	{
		name: "system",
		mountPath: "/system",
		createRouter: async () => (await import("@/routes/system.route")).default,
	},
	{
		name: "oidc",
		mountPath: "/oidc",
		createRouter: async () => (await import("@/routes/oidc.route")).default,
	},
	{
		name: "saml",
		mountPath: "/saml",
		createRouter: async () => (await import("@/routes/saml.route")).default,
	},
	{
		name: "rotation",
		mountPath: "/rotation",
		createRouter: async () => (await import("@/routes/rotation.route")).default,
	},
	{
		name: "dynamic_secret",
		mountPath: "/dynamic_secret",
		createRouter: async () => (await import("@/routes/dynamic_secret.route")).default,
	},
	{
		name: "log_forwarding",
		mountPath: "/log_forwarding",
		createRouter: async () => (await import("@/routes/log-forwarding.route")).default,
	},
];
