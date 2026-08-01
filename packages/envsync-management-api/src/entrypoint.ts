/**
 * Management API process entrypoint (P1).
 *
 * - Registers enterprise modules from envsync-enterprise (routes owned there)
 * - Builds app via local createManagementApp (wraps shared factory)
 * - No relative monorepo paths into envsync-api/src
 */
import "envsync-api/instrumentation";

import { registerManagementModules } from "envsync-api/modules";
import { bootstrapRuntime, getManagementPort } from "envsync-api/bootstrap";
import { enterpriseManagementModules } from "envsync-enterprise";

import { createManagementApp } from "./create-app";

registerManagementModules(enterpriseManagementModules);

await bootstrapRuntime("management");

const app = await createManagementApp();

export default {
	fetch: app.fetch.bind(app),
	port: getManagementPort(),
	idleTimeout: 255,
};
