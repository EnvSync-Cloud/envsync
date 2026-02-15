import { app } from "@/app";
import { CacheClient } from "@/libs/cache";
import { FGAClient } from "@/libs/openfga";
import { config } from "@/utils/env";
import { DB } from "@/libs/db";

CacheClient.init();
await DB.healthCheck();
await FGAClient.getInstance();

export default {
	fetch: app.fetch.bind(app),
	port: Number(config.PORT),
	idleTimeout: 255,
};
