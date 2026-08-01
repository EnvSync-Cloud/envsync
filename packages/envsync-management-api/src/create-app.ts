/**
 * Management process app factory (P1).
 * Thin wrap of shared createApiApp("management") — registration of EE modules
 * is the responsibility of this process (entrypoint), not core.
 */
import { createApiApp } from "envsync-api/factory";

export async function createManagementApp() {
	return createApiApp("management");
}
