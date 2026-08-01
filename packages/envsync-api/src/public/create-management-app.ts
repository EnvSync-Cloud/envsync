import { createApiApp } from "@/app/factory";

/**
 * @deprecated Prefer `envsync-management-api` `createManagementApp` for the
 * management process. Kept for in-process tests that register modules on core.
 */
export async function createManagementApp() {
	return createApiApp("management");
}
