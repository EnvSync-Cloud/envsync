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
	 * @param ttl Time to live in seconds (0 = no expiry)
	 */
	static async set(key: string, value: string, ttl?: number) {
		if (this._clientMode === "production") {
			if (ttl && ttl > 0) {
				await this._redisClient.SETEX(key, ttl, value);
			} else {
				await this._redisClient.SET(key, value);
			}
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

	/**
	 * Delete a single key from cache
	 * @param key Key to delete
	 */
	static async del(key: string): Promise<void> {
		if (this._clientMode === "production") {
			await this._redisClient.del(key);
		} else {
			this._nodeClient.del(key);
		}
	}

	/**
	 * Delete all keys matching a glob pattern
	 * @param pattern Glob pattern (e.g. "es:org:123:*")
	 */
	static async delByPattern(pattern: string): Promise<void> {
		if (this._clientMode === "production") {
			let cursor = "0";
			do {
				const result = await this._redisClient.scan(cursor as any, { MATCH: pattern, COUNT: 100 });
				cursor = String(result.cursor);
				if (result.keys.length > 0) {
					await this._redisClient.del(result.keys);
				}
			} while (cursor !== "0");
		} else {
			const regex = new RegExp("^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
			const allKeys = this._nodeClient.keys();
			const matching = allKeys.filter(k => regex.test(k));
			if (matching.length > 0) {
				this._nodeClient.del(matching);
			}
		}
	}

	/**
	 * Get multiple keys at once
	 * @param keys Array of keys to fetch
	 * @returns Array of values (null for missing keys)
	 */
	static async mget(keys: string[]): Promise<(string | null)[]> {
		if (keys.length === 0) return [];

		if (this._clientMode === "production") {
			const results = await this._redisClient.mGet(keys);
			return results;
		} else {
			return keys.map(k => (this._nodeClient.get(k) as string) || null);
		}
	}

	/**
	 * Check if a key exists in cache
	 * @param key Key to check
	 * @returns true if the key exists
	 */
	static async exists(key: string): Promise<boolean> {
		if (this._clientMode === "production") {
			const result = await this._redisClient.exists(key);
			return result === 1;
		} else {
			return this._nodeClient.has(key);
		}
	}
}
