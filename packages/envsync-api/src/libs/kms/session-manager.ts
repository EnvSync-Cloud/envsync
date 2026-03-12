import { DB } from "@/libs/db";
import { KMSClient } from "@/libs/kms/client";
import infoLogs, { LogTypes } from "@/libs/logger";

interface CachedSession {
	token: string;
	expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();

function cacheKey(memberId: string, orgId: string): string {
	return `${memberId}:${orgId}`;
}

/**
 * Get a vault session token for a (memberId, orgId) pair.
 * Caches tokens and refreshes when <60s TTL remains.
 */
export async function getVaultSessionToken(memberId: string, orgId: string): Promise<string> {
	const key = cacheKey(memberId, orgId);
	const cached = sessionCache.get(key);

	if (cached && cached.expiresAt - Date.now() > 60_000) {
		return cached.token;
	}

	const db = await DB.getInstance();
	const cert = await db
		.selectFrom("org_certificates")
		.select("serial_hex")
		.where("user_id", "=", memberId)
		.where("org_id", "=", orgId)
		.where("cert_type", "=", "member")
		.where("status", "=", "active")
		.orderBy("created_at", "desc")
		.executeTakeFirst();

	if (!cert) {
		throw new Error(`No active member certificate found for user ${memberId} in org ${orgId}`);
	}

	const kms = await KMSClient.getInstance();
	const result = await kms.createSessionManaged({
		memberId,
		orgId,
		certSerial: cert.serial_hex,
		scopes: ["vault:read", "vault:write", "vault:delete"],
	});

	const expiresAt = result.expiresAt
		? Number(result.expiresAt) * 1000
		: Date.now() + 3600_000;

	sessionCache.set(key, { token: result.sessionToken, expiresAt });

	infoLogs(
		`Vault session created for member ${memberId} in org ${orgId}`,
		LogTypes.LOGS,
		"SessionManager",
	);

	return result.sessionToken;
}

/**
 * Invalidate a cached session token (e.g. on logout/revocation).
 */
export function invalidateSessionToken(memberId: string, orgId: string): void {
	sessionCache.delete(cacheKey(memberId, orgId));
}
