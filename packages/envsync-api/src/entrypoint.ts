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

// Listen before DB/FGA/license so Swarm /health probes succeed immediately.
// Background work must not block the HTTP server.
const server = Bun.serve({
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
	hostname: "0.0.0.0",
});

CacheClient.init();
await DB.healthCheck();
await FGAClient.getInstance();
await registerApiBackgroundHandlers("core");
if (loadApiModules("management").length > 0) {
	await registerApiBackgroundHandlers("management");
}

export default server;
