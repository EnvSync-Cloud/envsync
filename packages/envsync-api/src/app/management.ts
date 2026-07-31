import log, { LogTypes } from "@/libs/logger";
import { registerManagementModules } from "@/modules/load-modules";
import { config } from "@/utils/env";
import { enterpriseManagementModules } from "envsync-enterprise";

import { createApiApp } from "./factory";

// In-process management app (tests / monorepo convenience).
// Production process uses envsync-management-api entrypoint with the same registration.
registerManagementModules(enterpriseManagementModules);

const managementApp = await createApiApp("management");

const apiRoutes = managementApp.routes;
log("Management API Routes:", LogTypes.LOGS, "ManagementEntrypoint");
apiRoutes.forEach(route => {
	log(`Method: ${route.method}, Path: ${route.path}`, LogTypes.LOGS, "ManagementEntrypoint");
});

log(`Management server started at http://localhost:${config.MANAGEMENT_API_PORT}`, LogTypes.LOGS, "ManagementEntrypoint");

export { managementApp };
