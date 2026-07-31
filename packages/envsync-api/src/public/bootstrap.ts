/**
 * Process bootstrap helpers exported for management-api (and other packages).
 * Prefer these over relative `../../envsync-api/src/...` imports.
 */
import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import { FGAClient } from "@/libs/openfga";
import { registerApiBackgroundHandlers } from "@/modules/load-modules";
import type { ApiSurface } from "@/modules/types";
import { config } from "@/utils/env";

export { config };
export { CacheClient, DB, FGAClient };
export { registerApiBackgroundHandlers };

/** Initialize cache, DB health, FGA, and surface background handlers. */
export async function bootstrapRuntime(surface: ApiSurface = "core") {
	CacheClient.init();
	await DB.healthCheck();
	await FGAClient.getInstance();
	await registerApiBackgroundHandlers(surface);
}

export function getManagementPort() {
	return Number(config.MANAGEMENT_API_PORT);
}

export function getCorePort() {
	return Number(config.PORT);
}
