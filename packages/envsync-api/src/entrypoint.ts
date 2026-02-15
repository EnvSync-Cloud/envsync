import { app } from "@/app";
import { CacheClient } from "@/libs/cache";
import { config } from "@/utils/env";
import { DB } from "@/libs/db";

CacheClient.init();
await DB.healthCheck();

export default {
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
};
