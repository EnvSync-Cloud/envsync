import { Hono } from "hono";
import { mountModules } from "envsync-kernel";

import { loadApiModules } from "@/modules/load-modules";
import type { ApiSurface } from "@/modules/types";

export async function createApiRoutes(surface: ApiSurface = "core") {
	const app = new Hono();
	await mountModules(app, loadApiModules(surface));
	return app;
}

const app = await createApiRoutes("core");

export default app;
