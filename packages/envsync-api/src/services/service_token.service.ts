import { createHash, randomUUID } from "node:crypto";

import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB, JsonValue } from "@/libs/db";
import { BusinessRuleError, orNotFound, ValidationError } from "@/libs/errors";
import type { ServiceTokenScope } from "@/types/db";

const TOKEN_PREFIX = "esv_";
const DEFAULT_GRACE_HOURS = 24;
const MAX_GRACE_HOURS = 7 * 24;

export type ServiceTokenRecord = {
	id: string;
	org_id: string;
	created_by_user_id: string;
	name: string;
	token_hash: string;
	app_id: string | null;
	env_type_id: string | null;
	permissions: Record<string, boolean>;
	scopes: ServiceTokenScope[];
	rotated_from_id: string | null;
	grace_until: Date | null;
	expires_at: Date;
	last_used_at: Date | null;
	created_at: Date;
	updated_at: Date;
};

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function normalizeServiceTokenPath(path?: string | null): string {
	if (!path || path === "/") return "/";
	const trimmed = path.trim();
	if (!trimmed || trimmed === "/") return "/";
	if (trimmed.includes("..")) {
		throw new ValidationError("Service token path must not contain '..'");
	}
	const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
	return withSlash.replace(/\/+$/, "") || "/";
}

export function parseServiceTokenScopes(
	raw: unknown,
	fallbackEnvTypeId?: string | null,
): ServiceTokenScope[] {
	let scopes: unknown = raw;
	if (typeof raw === "string") {
		try {
			scopes = JSON.parse(raw);
		} catch {
			scopes = [];
		}
	}

	if (!Array.isArray(scopes) || scopes.length === 0) {
		return [{ env_type_id: fallbackEnvTypeId ?? null, path: "/" }];
	}

	return scopes.map(entry => {
		const scope = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
		return {
			env_type_id: typeof scope.env_type_id === "string" ? scope.env_type_id : null,
			path: normalizeServiceTokenPath(typeof scope.path === "string" ? scope.path : "/"),
		};
	});
}

function toPublicServiceToken<T extends { token_hash: string }>(
	record: T,
	rawToken?: string,
): Omit<T, "token_hash"> & { token?: string } {
	const { token_hash: _tokenHash, ...rest } = record;
	if (rawToken !== undefined) {
		return { ...rest, token: rawToken };
	}
	return rest;
}

export class ServiceTokenService {
	public static generateToken(): string {
		return `${TOKEN_PREFIX}${randomUUID()}`;
	}

	public static isServiceTokenValue(token: string): boolean {
		return token.startsWith(TOKEN_PREFIX);
	}

	public static createToken = async ({
		org_id,
		created_by_user_id,
		name,
		app_id,
		env_type_id,
		permissions,
		scopes,
		expires_in_days,
	}: {
		org_id: string;
		created_by_user_id: string;
		name: string;
		app_id?: string;
		env_type_id?: string;
		permissions?: { read: boolean; write: boolean };
		scopes?: Array<{ env_type_id?: string | null; path?: string }>;
		expires_in_days?: number;
	}) => {
		const db = await DB.getInstance();
		const token = this.generateToken();
		const token_hash = hashToken(token);
		const expires_at = new Date(Date.now() + (expires_in_days ?? 90) * 24 * 60 * 60 * 1000);
		const normalizedScopes = parseServiceTokenScopes(scopes, env_type_id ?? null);
		const uniqueEnvTypeIds = [
			...new Set(normalizedScopes.map(scope => scope.env_type_id).filter((id): id is string => Boolean(id))),
		];
		const resolvedEnvTypeId = env_type_id ?? (uniqueEnvTypeIds.length === 1 ? uniqueEnvTypeIds[0] : null);

		const record = await db
			.insertInto("service_tokens")
			.values({
				id: uuidv4(),
				org_id,
				created_by_user_id,
				name,
				token_hash,
				app_id: app_id ?? null,
				env_type_id: resolvedEnvTypeId,
				permissions: permissions ?? { read: true, write: false },
				scopes: new JsonValue(normalizedScopes) as unknown as ServiceTokenScope[],
				rotated_from_id: null,
				grace_until: null,
				expires_at,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.serviceTokensByOrg(org_id));

		return toPublicServiceToken(
			{
				...record,
				scopes: parseServiceTokenScopes(record.scopes, record.env_type_id),
			},
			token,
		);
	};

	public static rotateToken = async ({
		id,
		org_id,
		grace_hours = DEFAULT_GRACE_HOURS,
	}: {
		id: string;
		org_id: string;
		grace_hours?: number;
	}) => {
		if (!Number.isInteger(grace_hours) || grace_hours < 0 || grace_hours > MAX_GRACE_HOURS) {
			throw new ValidationError("grace_hours must be an integer between 0 and 168");
		}

		const db = await DB.getInstance();
		const existing = await orNotFound(
			db
				.selectFrom("service_tokens")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Service Token",
			id,
		);

		if (existing.org_id !== org_id) {
			throw new BusinessRuleError("Service token not found", 404, "SERVICE_TOKEN_NOT_FOUND");
		}

		if (existing.grace_until) {
			throw new BusinessRuleError(
				"Service token has already been rotated",
				400,
				"SERVICE_TOKEN_ALREADY_ROTATED",
			);
		}

		const token = this.generateToken();
		const token_hash = hashToken(token);
		const now = new Date();
		const grace_until = new Date(now.getTime() + grace_hours * 60 * 60 * 1000);
		const scopes = parseServiceTokenScopes(existing.scopes, existing.env_type_id);

		const record = await db.transaction().execute(async trx => {
			const updated = await trx
				.updateTable("service_tokens")
				.set({ grace_until, updated_at: now })
				.where("id", "=", id)
				.where("grace_until", "is", null)
				.executeTakeFirst();

			if (!updated.numUpdatedRows || updated.numUpdatedRows === 0n) {
				throw new BusinessRuleError(
					"Service token has already been rotated",
					400,
					"SERVICE_TOKEN_ALREADY_ROTATED",
				);
			}

			return trx
				.insertInto("service_tokens")
				.values({
					id: uuidv4(),
					org_id: existing.org_id,
					created_by_user_id: existing.created_by_user_id,
					name: existing.name,
					token_hash,
					app_id: existing.app_id ?? null,
					env_type_id: existing.env_type_id ?? null,
					permissions: existing.permissions,
					scopes: new JsonValue(scopes) as unknown as ServiceTokenScope[],
					rotated_from_id: existing.id,
					grace_until: null,
					expires_at: existing.expires_at,
					created_at: now,
					updated_at: now,
				})
				.returningAll()
				.executeTakeFirstOrThrow();
		});

		await invalidateCache(
			CacheKeys.serviceTokenByHash(existing.token_hash),
			CacheKeys.serviceTokenByHash(token_hash),
			CacheKeys.serviceTokensByOrg(org_id),
		);

		return toPublicServiceToken(
			{
				...record,
				scopes: parseServiceTokenScopes(record.scopes, record.env_type_id),
			},
			token,
		);
	};

	public static getToken = async (id: string) => {
		const db = await DB.getInstance();

		const record = await orNotFound(
			db
				.selectFrom("service_tokens")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Service Token",
			id,
		);

		return toPublicServiceToken({
			...record,
			scopes: parseServiceTokenScopes(record.scopes, record.env_type_id),
		});
	};

	public static getAllTokens = async (
		orgId: string,
		page = 1,
		per_page = 50,
		appId?: string,
	) => {
		const db = await DB.getInstance();
		let query = db
			.selectFrom("service_tokens")
			.selectAll()
			.where("org_id", "=", orgId)
			.orderBy("created_at", "desc")
			.limit(per_page)
			.offset((page - 1) * per_page);
		if (appId) {
			query = query.where("app_id", "=", appId);
		}

		const records = await query.execute();
		return records.map(record =>
			toPublicServiceToken({
				...record,
				scopes: parseServiceTokenScopes(record.scopes, record.env_type_id),
			}),
		);
	};

	public static deleteToken = async (id: string) => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("service_tokens")
				.select(["token_hash", "org_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Service Token",
			id,
		);

		await db.deleteFrom("service_tokens").where("id", "=", id).executeTakeFirstOrThrow();

		await invalidateCache(
			CacheKeys.serviceTokenByHash(existing.token_hash),
			CacheKeys.serviceTokensByOrg(existing.org_id),
		);
	};

	public static isCurrentlyValid = (record: {
		expires_at: Date | string;
		grace_until?: Date | string | null;
	}): boolean => {
		const now = new Date();
		if (new Date(record.expires_at) < now) return false;
		if (record.grace_until && new Date(record.grace_until) <= now) return false;
		return true;
	};

	public static validateTokenByHash = async (token: string) => {
		const token_hash = hashToken(token);

		const record = await cacheAside(CacheKeys.serviceTokenByHash(token_hash), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const row = await db
				.selectFrom("service_tokens")
				.selectAll()
				.where("token_hash", "=", token_hash)
				.executeTakeFirst();

			if (!row) return null;

			return {
				...row,
				scopes: parseServiceTokenScopes(row.scopes, row.env_type_id),
			};
		});

		if (!record || !this.isCurrentlyValid(record)) return null;
		return record;
	};

	public static registerUsage = async (id: string) => {
		const db = await DB.getInstance();

		await db
			.updateTable("service_tokens")
			.set({ last_used_at: new Date(), updated_at: new Date() })
			.where("id", "=", id)
			.execute();
	};

	public static isScopedToApp = (token: { app_id: string | null }, appId: string): boolean => {
		return token.app_id === null || token.app_id === appId;
	};

	public static isScopedToEnvType = (token: { env_type_id: string | null }, envTypeId: string): boolean => {
		return token.env_type_id === null || token.env_type_id === envTypeId;
	};

	public static isPathAllowed = (
		token: { scopes?: unknown; env_type_id?: string | null },
		envTypeId: string,
		path: string,
	): boolean => {
		const scopes = parseServiceTokenScopes(token.scopes, token.env_type_id);
		const requested = normalizeServiceTokenPath(path);

		return scopes.some(scope => {
			if (scope.env_type_id && scope.env_type_id !== envTypeId) return false;
			if (scope.path === "/") return true;
			return requested === scope.path || requested.startsWith(`${scope.path}/`);
		});
	};

	public static hasEnvTypeScope = (
		token: { scopes?: unknown; env_type_id?: string | null },
		envTypeId: string,
	): boolean => {
		const scopes = parseServiceTokenScopes(token.scopes, token.env_type_id);
		return scopes.some(scope => !scope.env_type_id || scope.env_type_id === envTypeId);
	};

	public static hasRootPathScope = (
		token: { scopes?: unknown; env_type_id?: string | null },
		envTypeId: string,
	): boolean => {
		const scopes = parseServiceTokenScopes(token.scopes, token.env_type_id);
		return scopes.some(scope => {
			if (scope.env_type_id && scope.env_type_id !== envTypeId) return false;
			return scope.path === "/";
		});
	};

	public static filterKeysByScope = <T extends { key: string }>(
		token: { scopes?: unknown; env_type_id?: string | null },
		envTypeId: string,
		items: T[],
	): T[] => {
		return items.filter(item => this.isPathAllowed(token, envTypeId, item.key));
	};

	public static hasPermission = (
		token: { permissions: Record<string, boolean> },
		permission: "read" | "write",
	): boolean => {
		return token.permissions[permission] === true;
	};

	public static getScopeDenial = (
		token: {
			app_id: string | null;
			env_type_id?: string | null;
			permissions: Record<string, boolean>;
			scopes?: unknown;
		},
		input: {
			appId?: string;
			envTypeId?: string;
			paths?: string[];
			permission?: "read" | "write";
			allowKeyless?: boolean;
		},
	): string | null => {
		if (input.appId && !this.isScopedToApp(token, input.appId)) {
			return "Service token is not scoped to this application";
		}

		if (input.envTypeId && !this.hasEnvTypeScope(token, input.envTypeId)) {
			return "Service token is not scoped to this environment type";
		}

		const paths = input.paths ?? [];
		if (input.envTypeId && paths.length > 0) {
			for (const path of paths) {
				if (!this.isPathAllowed(token, input.envTypeId, path)) {
					return "Service token is not scoped to this path";
				}
			}
		} else if (input.envTypeId && paths.length === 0 && !input.allowKeyless) {
			if (!this.hasRootPathScope(token, input.envTypeId)) {
				return "Service token is not scoped to perform this keyless operation";
			}
		}

		if (input.permission && !this.hasPermission(token, input.permission)) {
			return `Service token does not have ${input.permission} permission`;
		}

		return null;
	};
}
