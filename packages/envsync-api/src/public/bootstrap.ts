/**
 * Process bootstrap helpers exported for other packages.
 * Prefer these over relative `../../envsync-api/src/...` imports.
 */
import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import { FGAClient } from "@/libs/openfga";
import { bootApiDependencies } from "@/libs/readiness";
import { registerApiBackgroundHandlers } from "@/modules/load-modules";
import type { ApiSurface } from "@/modules/types";
import { config } from "@/utils/env";

export { config };
export { CacheClient, DB, FGAClient };
export { registerApiBackgroundHandlers };

/** Initialize cache, retry Postgres/Redis/OpenFGA, then register background handlers. */
export async function bootstrapRuntime(surface: ApiSurface = "core") {
	await bootApiDependencies();
	await registerApiBackgroundHandlers(surface);
}

export function getCorePort() {
	return Number(config.PORT);
}
