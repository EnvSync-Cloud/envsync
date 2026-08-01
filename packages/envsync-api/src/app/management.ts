import log, { LogTypes } from "@/libs/logger";
import { MANAGE_API_PREFIX, registerManagementModules } from "@/modules/load-modules";
import { config } from "@/utils/env";
import { enterpriseManagementModules } from "envsync-enterprise";

import { createApiApp } from "./factory";

// In-process management-only app (tests / OpenAPI/SDK codegen).
// Production EE uses core entrypoint.enterprise.ts (same /api/v1/manage paths).
registerManagementModules(enterpriseManagementModules);

const managementApp = await createApiApp("management");

const apiRoutes = managementApp.routes;
log("Management API Routes:", LogTypes.LOGS, "ManagementEntrypoint");
apiRoutes.forEach(route => {
	log(`Method: ${route.method}, Path: ${route.path}`, LogTypes.LOGS, "ManagementEntrypoint");
});

log(
	`Management surface at http://localhost:${config.MANAGEMENT_API_PORT}${MANAGE_API_PREFIX}`,
	LogTypes.LOGS,
	"ManagementEntrypoint",
);

export { managementApp };
