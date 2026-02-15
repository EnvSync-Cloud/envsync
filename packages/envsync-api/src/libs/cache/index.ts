import NodeCache from "node-cache";
import * as redis from "redis";

import infoLogs, { LogTypes } from "@/libs/logger";
import { config } from "@/utils/env";

type CacheEnvironment = "development" | "production";

/**
 * CacheClient class to handle the caching
 */
export class CacheClient {
	private static _clientMode: CacheEnvironment;
	private static _redisClient: redis.RedisClientType;
	private static _nodeClient: NodeCache;

	/**
	 * Get the client based on the environment
	 */
	static get client() {
		return this._clientMode === "production" ? this._redisClient : this._nodeClient;
	}

	/**
	 * Get the environment
	 */
	static get env() {
		return this._clientMode;
	}

	/**
	 * Initialize the caching client
	 * @param forceEnv Force the environment to be set
	 */
	static init(forceEnv?: CacheEnvironment) {
		const env = (forceEnv ?? config.CACHE_ENV ?? config.NODE_ENV) || "development";

		if (!["development", "production"].includes(env))
			throw new Error(
				"Invalid Caching Environment, expected - ['development', 'production'], received - " + env,
			);

		this._clientMode = env as CacheEnvironment;

		const redisUrl = config.REDIS_URL ?? "";

		if (env === "production") {
			this._redisClient = redis.createClient({
				url: redisUrl,
				name: "ec-cache",
			});
			this._redisClient.connect();
		}

		this._nodeClient = new NodeCache();
		infoLogs(`Caching Client initialized in '${env}' environment`, LogTypes.LOGS, "CACHE:INIT");
	}

	/**
	 * Expose single function to handle the client write irrespective of the underlying connections
	 * @param key Key to be set
	 * @param value Value to be set
	 * @param ttl Time to live
	 */
	static async set(key: string, value: string, ttl?: number) {
		if (this._clientMode === "production") {
			await this._redisClient.SETEX(key, ttl ?? 0, value);
		} else {
			this._nodeClient.set(key, value, ttl ?? 0);
		}
	}

	/**
	 * Expose single function to handle the client read irrespective of the underlying connections
	 * @param key Key to be read
	 * @returns Value of the key
	 */
	static async get(key: string): Promise<string | null> {
		return this._clientMode === "production"
			? await this._redisClient.get(key)
			: (this._nodeClient.get(key) as string) || null;
	}
}
