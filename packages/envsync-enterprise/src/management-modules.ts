import type { ApiModule } from "envsync-kernel";

import { managementRouteLoaders as L } from "envsync-api/management-route-loaders";
import { startEnterpriseSyncWorker, startLicenseHeartbeat } from "./background";

/**
 * Canonical management / enterprise API module surface (D5 / H3).
 * Wired by `envsync-management-api` via `registerManagementModules`.
 * Background workers for enterprise sync are owned by this package (H3).
 * Capability services (OIDC/SAML/rotation/dyn-secret/log-forwarding) live under `./services` (H7).
 *
 * H3.4 migrations: physical source of truth is `./migrations/*`. The core process
 * migrator still discovers them via thin re-export shims under envsync-api so
 * Kysely migration names stay unique and OSS/core auto-migrate history is stable.
 * Do **not** also register `migrationDirectories` here while those shims exist
 * (would duplicate names in CompositeMigrationProvider).
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
