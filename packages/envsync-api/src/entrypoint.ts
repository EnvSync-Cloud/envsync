import "./instrumentation";
import { app } from "@/app";
import { bootOrExit, enableStartupReadinessGate } from "@/libs/readiness";
import { config } from "@/utils/env";
import {
	loadApiModules,
	registerApiBackgroundHandlers,
} from "@/modules/load-modules";

// Listen first so orchestrators can observe /health while dependencies retry.
// /health stays unavailable until Postgres is reachable and boot has finished.
enableStartupReadinessGate();

const server = Bun.serve({
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
	hostname: "0.0.0.0",
});

await bootOrExit(code => {
	void server.stop(true);
	process.exit(code);
});

await registerApiBackgroundHandlers("core");
if (loadApiModules("management").length > 0) {
	await registerApiBackgroundHandlers("management");
}

export default server;
