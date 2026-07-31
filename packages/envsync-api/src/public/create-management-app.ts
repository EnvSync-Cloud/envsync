import { createApiApp } from "@/app/factory";

/**
 * Build the management Hono app after `registerManagementModules(...)` has run.
 */
export async function createManagementApp() {
	return createApiApp("management");
}
