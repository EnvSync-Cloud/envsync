import { createPrivateKey, sign as cryptoSign } from "node:crypto";

import { BusinessRuleError } from "@/libs/errors";
import { KMSClient } from "@/libs/kms/client";
import infoLogs, { LogTypes } from "@/libs/logger";
import { AuthorizationService } from "@/services/authorization.service";
import { CertificateService } from "@/services/certificate.service";

interface CachedSession {
	token: string;
	expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();
const pendingSessionCreates = new Map<string, Promise<CachedSession>>();

function hashScopes(scopes: string[]): string {
	return scopes.slice().sort().join(",");
}

function cacheKey(memberId: string, orgId: string, certSerial: string, scopes: string[]): string {
	return `${memberId}:${orgId}:${certSerial}:${hashScopes(scopes)}`;
}

function isSessionNearExpiry(session: CachedSession) {
	return session.expiresAt - Date.now() > 60_000;
}

function isActiveSessionLimitError(error: unknown) {
	return error instanceof Error && error.message.includes("maximum number of active sessions");
}

function signMemberNonce(keyPem: string, nonce: Buffer) {
	const key = createPrivateKey(keyPem);
	return cryptoSign("sha256", nonce, { key, dsaEncoding: "der" });
}

async function createCertSessionWithRecovery(
	kms: KMSClient,
	memberId: string,
	orgId: string,
	certPem: string,
	keyPem: string,
	certSerial: string,
	scopes: string[],
) {
	const mint = async () => {
		const challenge = await kms.issueSessionChallenge(certSerial);
		const signedNonce = signMemberNonce(keyPem, challenge.nonce);
		return kms.createSessionByCert({
			certPem,
			signedNonce,
			nonce: challenge.nonce,
			scopes,
		});
	};
	try {
		return await mint();
	} catch (error) {
		if (!isActiveSessionLimitError(error)) {
			throw error;
		}

		const revokedCount = await kms.revokeMemberSessions(memberId, orgId);
		infoLogs(
			`Revoked ${revokedCount} stale vault sessions for member ${memberId} in org ${orgId} after hitting the active-session limit`,
			LogTypes.LOGS,
			"SessionManager",
		);

		return await mint();
	}
}

function getRequiredScopes(permissions: Awaited<ReturnType<typeof AuthorizationService.getUserOrgPermissions>>) {
	const scopes = new Set<string>();

	if (permissions.can_view || permissions.can_edit || permissions.is_admin || permissions.is_master) {
		scopes.add("vault:read");
	}
	if (permissions.can_edit || permissions.is_admin || permissions.is_master) {
		scopes.add("vault:write");
	}
	// The current miniKMS managed-session contract only grants delete to admin/master roles.
	// Requesting vault:delete for editable member sessions causes the session to be filtered
	// down and rejected before otherwise valid read/write flows can proceed.
	if (permissions.is_admin || permissions.is_master) {
		scopes.add("vault:delete");
	}

	return Array.from(scopes).sort();
}

/**
 * Get a vault session token for a (memberId, orgId) pair.
 * Caches tokens and refreshes when <60s TTL remains.
 */
export async function getVaultSessionToken(memberId: string, orgId: string): Promise<string> {
	const [proof, permissions] = await Promise.all([
		CertificateService.loadSystemMemberProof(orgId, memberId),
		AuthorizationService.getUserOrgPermissions(memberId, orgId),
	]);

	if (!proof) {
		throw new BusinessRuleError(
			"No system member certificate with a durable private key is available for vault access.",
			409,
			"MEMBER_KEY_UNAVAILABLE",
		);
	}

	const scopes = getRequiredScopes(permissions);
	if (scopes.length === 0) {
		throw new BusinessRuleError(
			"User does not have permission to access vault resources.",
			403,
			"VAULT_SESSION_SCOPE_INSUFFICIENT",
		);
	}

	const key = cacheKey(memberId, orgId, proof.serialHex, scopes);
	const cached = sessionCache.get(key);
	if (cached && isSessionNearExpiry(cached)) {
		return cached.token;
	}

	const pending = pendingSessionCreates.get(key);
	if (pending) {
		const session = await pending;
		if (isSessionNearExpiry(session)) {
			return session.token;
		}
	}

	const kms = await KMSClient.getInstance();
	const createPromise = (async () => {
		const result = await createCertSessionWithRecovery(
			kms,
			memberId,
			orgId,
			proof.certPem,
			proof.keyPem,
			proof.serialHex,
			scopes,
		);

		const missingScopes = scopes.filter(scope => !result.scopes.includes(scope));
		if (missingScopes.length > 0) {
			throw new BusinessRuleError(
				`Managed vault session missing required scopes: ${missingScopes.join(", ")}`,
				403,
				"VAULT_SESSION_SCOPE_INSUFFICIENT",
			);
		}

		const expiresAt = result.expiresAt
			? Number(result.expiresAt) * 1000
			: Date.now() + 3600_000;
		const session = { token: result.sessionToken, expiresAt };

		sessionCache.set(key, session);

		infoLogs(
			`Vault session created for member ${memberId} in org ${orgId}`,
			LogTypes.LOGS,
			"SessionManager",
		);

		return session;
	})();

	pendingSessionCreates.set(key, createPromise);

	try {
		const session = await createPromise;
		return session.token;
	} finally {
		pendingSessionCreates.delete(key);
	}
}

/**
 * Invalidate a cached session token (e.g. on logout/revocation).
 */
export function invalidateSessionToken(memberId: string, orgId: string): void {
	for (const key of sessionCache.keys()) {
		if (key.startsWith(`${memberId}:${orgId}:`)) {
			sessionCache.delete(key);
		}
	}
	for (const key of pendingSessionCreates.keys()) {
		if (key.startsWith(`${memberId}:${orgId}:`)) {
			pendingSessionCreates.delete(key);
		}
	}
}
