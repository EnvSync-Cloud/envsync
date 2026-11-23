import NodeCache from "node-cache";
import { SpanKind } from "@opentelemetry/api";
import * as redis from "redis";

import infoLogs, { LogTypes } from "@/libs/logger";
import { withSpan } from "@/libs/telemetry";
import { cacheOperations } from "@/libs/telemetry/metrics";
import { config } from "@/utils/env";

type CacheEnvironment = "development" | "production";

function safeCacheMessage(err: unknown) {
	const message = err instanceof Error ? err.message : "connection failed";
	return message.replace(/\/\/[^@\s]+@/g, "//");
}

/**
 * CacheClient class to handle the caching
 */
export class CacheClient {
	private static _clientMode: CacheEnvironment;
	private static _redisClient: redis.RedisClientType | undefined;
	private static _redisConnect: Promise<void> | undefined;
	private static _nodeClient: NodeCache;

	private static ensureNodeClient() {
		if (!this._nodeClient) {
			this._nodeClient = new NodeCache();
		}
	}

	private static ensureRedisClient() {
		if (this._redisClient) return;

		this._redisClient = redis.createClient({
			url: config.REDIS_URL ?? "",
			name: "ec-cache",
			socket: {
				connectTimeout: 5_000,
				reconnectStrategy: (retries: number) =>
					retries >= 2 ? new Error("Redis reconnect retries exhausted") : Math.min(100 * 2 ** retries, 1_000),
			},
		});
		this._redisClient.on("error", (err: Error) => {
			infoLogs(`Redis client error: ${safeCacheMessage(err)}`, LogTypes.ERROR, "CACHE");
		});
	}

	private static resetRedisClient() {
		const client = this._redisClient;
		this._redisClient = undefined;
		this._redisConnect = undefined;
		if (!client) return;
		try {
			client.destroy();
		} catch {
			// The failed client is being dropped.
		}
	}

	private static async connectRedis() {
		this.ensureRedisClient();
		const client = this._redisClient;
		if (!client) {
			throw new Error("Redis client is not configured");
		}
		if (client.isReady) return;
		if (!this._redisConnect) {
			this._redisConnect = client.connect().then(() => undefined).catch((err: unknown) => {
				infoLogs(`Redis connection failed: ${safeCacheMessage(err)}`, LogTypes.ERROR, "CACHE:INIT");
				if (this._redisClient === client) this.resetRedisClient();
				throw err instanceof Error ? err : new Error("Redis connection failed");
			});
		}
		await this._redisConnect;
	}

	private static async requireRedis() {
		await this.connectRedis();
		if (!this._redisClient) {
			throw new Error("Redis client is not connected");
		}
		return this._redisClient;
	}

	/** Production Redis answers PING. The development cache is process-local. */
	static async ping(): Promise<boolean> {
		if (this._clientMode !== "production") return true;
		try {
			const client = await this.requireRedis();
			const reply = await client.ping();
			return reply === "PONG";
		} catch (err) {
			infoLogs(`Redis ping failed: ${safeCacheMessage(err)}`, LogTypes.ERROR, "CACHE");
			this.resetRedisClient();
			return false;
		}
	}

	private static ensureInitialized() {
		if (!this._clientMode) {
			this._clientMode = "development";
		}

		if (this._clientMode === "production") {
			this.ensureRedisClient();
			return;
		}

		this.ensureNodeClient();
	}

	/**
	 * Get the client based on the environment
	 */
	static get client() {
		this.ensureInitialized();
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

		if (env === "production") {
			this.ensureRedisClient();
			void this.connectRedis().catch(() => undefined);
		} else {
			this.ensureNodeClient();
		}

		infoLogs(`Caching Client initialized in '${env}' environment`, LogTypes.LOGS, "CACHE:INIT");
	}

	/**
	 * Expose single function to handle the client write irrespective of the underlying connections
	 * @param key Key to be set
	 * @param value Value to be set
	 * @param ttl Time to live in seconds (0 = no expiry)
	 */
	static async set(key: string, value: string, ttl?: number) {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache SET", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "SET",
			"cache.key": key,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "SET" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				if (ttl && ttl > 0) {
					await client.SETEX(key, ttl, value);
				} else {
					await client.SET(key, value);
				}
			} else {
				this._nodeClient.set(key, value, ttl ?? 0);
			}
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Expose single function to handle the client read irrespective of the underlying connections
	 * @param key Key to be read
	 * @returns Value of the key
	 */
	static async get(key: string): Promise<string | null> {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache GET", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "GET",
			"cache.key": key,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "GET" });
			const value = this._clientMode === "production"
				? await (await this.requireRedis()).get(key)
				: (this._nodeClient.get(key) as string) || null;
			infoLogs(
				`Cache GET key=${key} cache_hit=${value !== null}`,
				LogTypes.LOGS,
				"CACHE:GET",
			);
			return value;
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Atomically get and delete a key (Redis GETDEL). Used for one-time SAML AuthnRequests.
	 */
	static async getdel(key: string): Promise<string | null> {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache GETDEL", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "GETDEL",
			"cache.key": key,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "GETDEL" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				return await client.getDel(key);
			}
			const value = (this._nodeClient.get(key) as string) || null;
			if (value !== null) {
				this._nodeClient.del(key);
			}
			return value;
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Delete a single key from cache
	 * @param key Key to delete
	 */
	static async del(key: string): Promise<void> {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache DEL", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "DEL",
			"cache.key": key,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "DEL" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				await client.del(key);
			} else {
				this._nodeClient.del(key);
			}
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Delete all keys matching a glob pattern
	 * @param pattern Glob pattern (e.g. "es:org:123:*")
	 */
	static async delByPattern(pattern: string): Promise<void> {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache DEL_PATTERN", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "DEL_PATTERN",
			"cache.key": pattern,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "DEL_PATTERN" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				let cursor = "0";
				do {
					const result = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
					cursor = String(result.cursor);
					if (result.keys.length > 0) {
						await client.del(result.keys);
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
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Get multiple keys at once
	 * @param keys Array of keys to fetch
	 * @returns Array of values (null for missing keys)
	 */
	static async mget(keys: string[]): Promise<(string | null)[]> {
		this.ensureInitialized();
		if (keys.length === 0) return [];
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";

		return withSpan("cache MGET", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "MGET",
			"cache.key": keys.join(","),
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "MGET" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				return await client.mGet(keys);
			} else {
				return keys.map(k => (this._nodeClient.get(k) as string) || null);
			}
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}

	/**
	 * Check if a key exists in cache
	 * @param key Key to check
	 * @returns true if the key exists
	 */
	static async exists(key: string): Promise<boolean> {
		this.ensureInitialized();
		const redisUrl = config.REDIS_URL ? new URL(config.REDIS_URL) : undefined;
		const isRedis = this._clientMode === "production";
		return withSpan("cache EXISTS", {
			"db.system": isRedis ? "redis" : "node-cache",
			"db.operation.name": "EXISTS",
			"cache.key": key,
			...(isRedis ? {
				"peer.service": "redis",
				"server.address": redisUrl?.hostname ?? "redis",
				"server.port": Number(redisUrl?.port || "6379"),
				"network.peer.address": redisUrl?.hostname ?? "redis",
			} : {}),
		}, async () => {
			cacheOperations.add(1, { "db.operation.name": "EXISTS" });
			if (this._clientMode === "production") {
				const client = await this.requireRedis();
				const result = await client.exists(key);
				return result === 1;
			} else {
				return this._nodeClient.has(key);
			}
		}, isRedis ? SpanKind.CLIENT : SpanKind.INTERNAL);
	}
}
