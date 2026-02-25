import "./instrumentation";
import { app } from "@/app";
import { CacheClient } from "@/libs/cache";
import { STDBClient } from "@/libs/stdb";
import { config } from "@/utils/env";

CacheClient.init();
await STDBClient.getInstance().healthCheck();

export default {
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
};
