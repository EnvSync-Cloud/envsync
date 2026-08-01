import type { ApiModule } from "envsync-kernel";

import { managementRouteLoaders as L } from "envsync-api/management-route-loaders";
import { startEnterpriseSyncWorker, startLicenseHeartbeat } from "./background";

/**
 * Canonical management / enterprise API module surface (D5 / H3).
 * Wired by `envsync-management-api` via `registerManagementModules`.
 * Background workers for enterprise sync are owned by this package (H3).
 */
export const enterpriseManagementModules: ApiModule[] = [
	{
		name: "onboarding",
		mountPath: "/onboarding",
		createRouter: L.onboarding,
	},
	{
		name: "license",
		mountPath: "/license",
		createRouter: L.license,
		registerBackgroundHandlers: startLicenseHeartbeat,
	},
	{
		name: "enterprise",
		mountPath: "/enterprise",
		createRouter: L.enterprise,
		registerBackgroundHandlers: startEnterpriseSyncWorker,
	},
	{
		name: "system",
		mountPath: "/system",
		createRouter: L.system,
	},
	{
		name: "oidc",
		mountPath: "/oidc",
		createRouter: L.oidc,
	},
	{
		name: "saml",
		mountPath: "/saml",
		createRouter: L.saml,
	},
	{
		name: "rotation",
		mountPath: "/rotation",
		createRouter: L.rotation,
	},
	{
		name: "dynamic_secret",
		mountPath: "/dynamic_secret",
		createRouter: L.dynamicSecret,
	},
	{
		name: "log_forwarding",
		mountPath: "/log_forwarding",
		createRouter: L.logForwarding,
	},
];
