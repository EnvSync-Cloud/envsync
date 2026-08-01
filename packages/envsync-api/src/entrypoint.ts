import "./instrumentation";
import { app } from "@/app";
import { CacheClient } from "@/libs/cache";
import { FGAClient } from "@/libs/openfga";
import { config } from "@/utils/env";
import { DB } from "@/libs/db";
import {
	loadApiModules,
	registerApiBackgroundHandlers,
} from "@/modules/load-modules";

CacheClient.init();
await DB.healthCheck();
await FGAClient.getInstance();
// Core always; manage workers when modules were registered at createApiApp time.
await registerApiBackgroundHandlers("core");
if (loadApiModules("management").length > 0) {
	await registerApiBackgroundHandlers("management");
}

export default {
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
};
