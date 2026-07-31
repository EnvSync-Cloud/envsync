/**
 * Management API process entrypoint (Phase 5 / D5).
 * Dependency graph: envsync-kernel ← envsync-api ← envsync-enterprise ← this package.
 * No relative monorepo path imports into envsync-api/src.
 */
import "envsync-api/instrumentation";

import { registerManagementModules } from "envsync-api/modules";
import { bootstrapRuntime, getManagementPort } from "envsync-api/bootstrap";
import { createManagementApp } from "envsync-api/create-management-app";
import { enterpriseManagementModules } from "envsync-enterprise";

registerManagementModules(enterpriseManagementModules);

await bootstrapRuntime("management");

const app = await createManagementApp();

export default {
	fetch: app.fetch.bind(app),
	port: getManagementPort(),
	idleTimeout: 255,
};
