import { createHash, timingSafeEqual } from "node:crypto";

import { SecretKeyGenerator } from "sk-keygen";
import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import { orNotFound } from "@/libs/errors";
import { PlanLimitService } from "@/services/plan_limit.service";

const STORED_HASH = /^[a-f0-9]{64}$/;
const KEY_HINT_PREFIX_LENGTH = 8;
const DUMMY_API_KEY_HASH = createHash("sha256").update("envsync-api-key-miss").digest("hex");

type ApiKeyAuthRecord = {
	id: string;
	user_id: string;
	org_id: string;
	is_active: boolean;
};

type CachedApiKeyAuth = ApiKeyAuthRecord & {
	key_hash: string;
};

function hashApiKey(apiKey: string): string {
	// API keys are 256-bit secrets from SecretKeyGenerator. SHA-256 is the lookup
	// key. A slow password hash would not add a secret and would break indexed lookup.
	// codeql[js/insufficient-password-hash]
	return createHash("sha256").update(apiKey).digest("hex");
}

function isStoredHash(value: string): boolean {
	return STORED_HASH.test(value);
}

function constantTimeEqual(left: string, right: string): boolean {
	const a = Buffer.from(left);
	const b = Buffer.from(right);
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

function keyHint(rawKey: string): string {
	if (rawKey.length <= KEY_HINT_PREFIX_LENGTH) return "••••••••";
	return `${rawKey.slice(0, KEY_HINT_PREFIX_LENGTH)}…`;
}

function authOf(row: ApiKeyAuthRecord): ApiKeyAuthRecord {
	return {
		id: row.id,
		user_id: row.user_id,
		org_id: row.org_id,
		is_active: row.is_active,
	};
}

function isCachedAuth(value: unknown): value is CachedApiKeyAuth {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.id === "string" &&
		typeof row.user_id === "string" &&
		typeof row.org_id === "string" &&
		typeof row.is_active === "boolean" &&
		typeof row.key_hash === "string"
	);
}

function toPublicApiKey<T extends { key: string; key_hint?: string | null }>(
	record: T,
	rawKey?: string,
) {
	const hint = record.key_hint ?? (isStoredHash(record.key) ? null : keyHint(record.key));
	const { key: _stored, ...rest } = record;
	const pub = { ...rest, key_hint: hint };
	if (rawKey !== undefined) {
		return { ...pub, key: rawKey };
	}
	return pub;
}

function generateApiKey() {
	const raw = SecretKeyGenerator.generateKey({ prefix: "eVs" });
	return { raw, hash: hashApiKey(raw), hint: keyHint(raw) };
}

async function invalidateApiKeyRecord(record: { key: string; org_id: string; user_id: string }) {
	const keys = [CacheKeys.apiKeysByOrg(record.org_id), CacheKeys.apiKeysByUser(record.user_id)];
	if (isStoredHash(record.key)) {
		keys.push(CacheKeys.apiKeyByHash(record.key));
	}
	await invalidateCache(...keys);
}

async function readAuthCache(digest: string): Promise<CachedApiKeyAuth | null> {
	try {
		const raw = await CacheClient.get(CacheKeys.apiKeyByHash(digest));
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isCachedAuth(parsed) || !constantTimeEqual(parsed.key_hash, digest)) return null;
		return parsed;
	} catch {
		return null;
	}
}

async function writeAuthCache(record: CachedApiKeyAuth): Promise<void> {
	try {
		await CacheClient.set(CacheKeys.apiKeyByHash(record.key_hash), JSON.stringify(record), CacheTTL.SHORT);
	} catch {
		// Authentication must succeed even when the cache is down. Do not log the credential.
	}
}

async function upgradeLegacyKey(presented: string, digest: string): Promise<ApiKeyAuthRecord | null> {
	const db = await DB.getInstance();
	const row = await db
		.selectFrom("api_keys")
		.select(["id", "user_id", "org_id", "is_active", "key", "key_hint"])
		.where("key", "=", presented)
		.executeTakeFirst();

	if (!row) return null;
	// A database read of the hash must not authenticate. Only a pre-hash plaintext row may upgrade.
	if (!constantTimeEqual(row.key, presented) || isStoredHash(row.key)) return null;

	const hint = row.key_hint ?? keyHint(presented);
	const updated = await db
		.updateTable("api_keys")
		.set({
			key: digest,
			key_hint: hint,
			updated_at: new Date(),
		})
		.where("id", "=", row.id)
		.where("key", "=", presented)
		.executeTakeFirst();

	if (!updated.numUpdatedRows) {
		const current = await db
			.selectFrom("api_keys")
			.select(["id", "user_id", "org_id", "is_active", "key"])
			.where("id", "=", row.id)
			.executeTakeFirst();
		if (!current || !constantTimeEqual(current.key, digest)) return null;
		const auth = authOf(current);
		await writeAuthCache({ ...auth, key_hash: digest });
		return auth;
	}

	await invalidateCache(CacheKeys.apiKeysByOrg(row.org_id), CacheKeys.apiKeysByUser(row.user_id));
	const auth = authOf(row);
	await writeAuthCache({ ...auth, key_hash: digest });
	return auth;
}

export class ApiKeyService {
	public static createKey = async ({
		user_id,
		org_id,
		description,
	}: {
		user_id: string;
		org_id: string;
		description?: string;
	}) => {
		const db = await DB.getInstance();
		await PlanLimitService.assertCount(org_id, "api_keys");
		const generated = generateApiKey();

		const record = await db
			.insertInto("api_keys")
			.values({
				id: uuidv4(),
				user_id,
				org_id,
				description: description || "",
				is_active: true,
				key: generated.hash,
				key_hint: generated.hint,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.apiKeysByOrg(org_id), CacheKeys.apiKeysByUser(user_id));

		return toPublicApiKey(record, generated.raw);
	};

	public static getKey = async (id: string) => {
		const db = await DB.getInstance();

		const key = await orNotFound(
			db.selectFrom("api_keys").selectAll().where("id", "=", id).executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		return toPublicApiKey(key);
	};

	public static getAllKeys = async (orgId: string, page = 1, per_page = 50) => {
		const db = await DB.getInstance();

		const keys = await db
			.selectFrom("api_keys")
			.selectAll()
			.where("org_id", "=", orgId)
			.limit(per_page)
			.offset((page - 1) * per_page)
			.execute();

		return keys.map(key => toPublicApiKey(key));
	};

	public static updateKey = async (
		id: string,
		data: {
			description?: string;
			is_active?: boolean;
			last_used_at?: Date;
		},
	) => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id", "user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		await db
			.updateTable("api_keys")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateApiKeyRecord(existing);
	};

	public static deleteKey = async (id: string) => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id", "user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		await db.deleteFrom("api_keys").where("id", "=", id).executeTakeFirstOrThrow();

		await invalidateApiKeyRecord(existing);
	};

	public static regenerateKey = async (id: string) => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id", "user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		const generated = generateApiKey();

		await db
			.updateTable("api_keys")
			.set({
				key: generated.hash,
				key_hint: generated.hint,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateApiKeyRecord(existing);
		await invalidateCache(CacheKeys.apiKeyByHash(generated.hash));

		return { newKey: generated.raw, id };
	};

	public static getKeyByUserId = async (userId: string) => {
		return cacheAside(CacheKeys.apiKeysByUser(userId), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const keys = await db
				.selectFrom("api_keys")
				.selectAll()
				.where("user_id", "=", userId)
				.execute();

			return keys.map(key => toPublicApiKey(key));
		});
	};

	public static getKeyByCreds = async (apiKey: string) => {
		if (!apiKey) return null;

		const digest = hashApiKey(apiKey);
		const cached = await readAuthCache(digest);
		if (cached) return authOf(cached);

		const db = await DB.getInstance();
		const row = await db
			.selectFrom("api_keys")
			.select(["id", "user_id", "org_id", "is_active", "key"])
			.where("key", "=", digest)
			.executeTakeFirst();

		if (row) {
			if (!constantTimeEqual(row.key, digest)) return null;
			const auth = authOf(row);
			await writeAuthCache({ ...auth, key_hash: digest });
			return auth;
		}

		void constantTimeEqual(DUMMY_API_KEY_HASH, digest);
		return upgradeLegacyKey(apiKey, digest);
	};

	public static registerKeyUsage = async (id: string) => {
		const db = await DB.getInstance();

		await db
			.updateTable("api_keys")
			.set({
				last_used_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	};
}
