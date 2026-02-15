import { CacheClient } from "@/libs/cache";
import infoLogs, { LogTypes } from "@/libs/logger";

/**
 * Cache-aside helper: check cache → miss → call loader → write cache → return.
 * Cache errors never propagate — graceful degradation to DB.
 */
export async function cacheAside<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
	try {
		const cached = await CacheClient.get(key);
		if (cached !== null) {
			return JSON.parse(cached) as T;
		}
	} catch (err) {
		infoLogs(`Cache read error for key=${key}: ${err}`, LogTypes.ERROR, "CACHE:READ");
	}

	const result = await loader();

	try {
		await CacheClient.set(key, JSON.stringify(result), ttl);
	} catch (err) {
		infoLogs(`Cache write error for key=${key}: ${err}`, LogTypes.ERROR, "CACHE:WRITE");
	}

	return result;
}

/**
 * Invalidate cache entries by exact keys or glob patterns.
 * Patterns containing '*' or '?' are treated as globs.
 * Silently logs errors — never throws.
 */
export async function invalidateCache(...keysOrPatterns: string[]): Promise<void> {
	for (const keyOrPattern of keysOrPatterns) {
		try {
			if (keyOrPattern.includes("*") || keyOrPattern.includes("?")) {
				await CacheClient.delByPattern(keyOrPattern);
			} else {
				await CacheClient.del(keyOrPattern);
			}
		} catch (err) {
			infoLogs(
				`Cache invalidation error for pattern=${keyOrPattern}: ${err}`,
				LogTypes.ERROR,
				"CACHE:INVALIDATE",
			);
		}
	}
}
