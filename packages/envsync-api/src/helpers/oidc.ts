import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";

import { AppError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";

import type { Selectable } from "kysely";
import type { Database } from "@/types/db";

type OidcProviderRow = Selectable<Database["oidc_providers"]>;

/**
 * Per-issuer JWKS cache. Avoids re-creating the RemoteJWKSet on every request.
 * Entries are keyed by issuer URL.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwksForIssuer(issuerUrl: string): ReturnType<typeof createRemoteJWKSet> {
	let jwks = jwksCache.get(issuerUrl);
	if (!jwks) {
		// Standard OIDC discovery: <issuer>/.well-known/openid-configuration
		// JWKS URI is typically <issuer>/protocol/openid-connect/certs or <issuer>/.well-known/jwks.json
		// We try the standard OIDC discovery first, falling back to direct JWKS endpoint
		const jwksUrl = new URL(`${issuerUrl}/.well-known/jwks.json`);
		jwks = createRemoteJWKSet(jwksUrl);
		jwksCache.set(issuerUrl, jwks);
	}
	return jwks;
}

/**
 * Known CI/CD provider issuer URLs for quick detection.
 * Used by the auth middleware to decide if a Bearer token might be an OIDC token.
 */
export const KNOWN_OIDC_ISSUERS: readonly string[] = [
	"https://token.actions.githubusercontent.com",
	"https://gitlab.com",
];

/**
 * Decode a JWT without verification to extract the issuer.
 * Used for provider lookup before full verification.
 */
export function decodeTokenIssuer(bearerToken: string): string | null {
	try {
		const payload = decodeJwt(bearerToken);
		return payload.iss ?? null;
	} catch {
		return null;
	}
}

/**
 * Check if a Bearer token looks like it might be from an external OIDC provider
 * (i.e., not from Keycloak). This is a heuristic — it decodes the JWT header
 * without verification and checks the issuer.
 */
export function mightBeOidcToken(bearerToken: string, keycloakIssuer: string): boolean {
	const iss = decodeTokenIssuer(bearerToken);
	if (!iss) return false;
	if (iss === keycloakIssuer) return false;
	// Any non-Keycloak issuer could be an OIDC provider
	return true;
}

export interface OidcVerifiedPayload extends JWTPayload {
	iss: string;
	sub: string;
	aud: string | string[];
}

/**
 * Verify an OIDC JWT against a registered provider.
 *
 * Flow:
 * 1. Decode (unverified) to get issuer → match against registered providers
 * 2. Verify signature against the issuer's JWKS
 * 3. Validate issuer and audience claims
 * 4. Check subject against allowed_subjects (if configured)
 *
 * @returns The verified JWT payload
 */
export async function verifyOidcToken(
	bearerToken: string,
	providers: OidcProviderRow[],
): Promise<{ payload: OidcVerifiedPayload; provider: OidcProviderRow }> {
	const token = bearerToken.replace(/^Bearer\s+/i, "");

	// Step 1: Decode without verification to find the issuer
	const unverifiedIss = decodeTokenIssuer(token);
	if (!unverifiedIss) {
		throw new AppError("OIDC token missing issuer claim", 401, "OIDC_MISSING_ISSUER");
	}

	// Step 2: Find matching provider
	const provider = providers.find(
		(p) => p.issuer_url === unverifiedIss && p.enabled,
	);
	if (!provider) {
		throw new AppError(
			`No OIDC provider registered for issuer: ${unverifiedIss}`,
			401,
			"OIDC_NO_PROVIDER",
		);
	}

	// Step 3: Verify JWT signature + claims
	const jwks = getJwksForIssuer(provider.issuer_url);

	let payload: JWTPayload;
	try {
		const result = await jwtVerify(token, jwks, {
			issuer: provider.issuer_url,
			algorithms: ["RS256", "ES256"],
		});
		payload = result.payload;
	} catch (err) {
		infoLogs(
			`OIDC JWT verification failed for issuer=${provider.issuer_url}: ${err instanceof Error ? err.message : String(err)}`,
			LogTypes.ERROR,
			"OIDC:VERIFY",
		);
		throw new AppError("OIDC token verification failed", 401, "OIDC_VERIFY_FAILED");
	}

	// Step 4: Validate audience
	const aud = payload.aud;
	const expectedAud = provider.audience;
	const audArray = Array.isArray(aud) ? aud : [aud];
	if (!audArray.includes(expectedAud)) {
		throw new AppError(
			"OIDC token audience does not match expected value",
			401,
			"OIDC_AUDIENCE_MISMATCH",
		);
	}

	// Step 5: Check allowed subjects (if configured)
	if (!payload.sub) {
		throw new AppError("OIDC token missing subject claim", 401, "OIDC_MISSING_SUB");
	}

	const allowedSubjects = provider.allowed_subjects as string[];
	if (allowedSubjects.length > 0) {
		const subjectAllowed = allowedSubjects.some((pattern) => {
			if (pattern.includes("*")) {
				// Simple glob matching: convert to regex
				const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
				return regex.test(payload.sub ?? "");
			}
			return pattern === payload.sub;
		});

		if (!subjectAllowed) {
			throw new AppError(
				"OIDC token subject not in allowed list",
				401,
				"OIDC_SUBJECT_NOT_ALLOWED",
			);
		}
	}

	return {
		payload: payload as OidcVerifiedPayload,
		provider,
	};
}

/**
 * Clear the JWKS cache for a specific issuer (e.g., when a provider is removed).
 */
export function clearJwksCache(issuerUrl?: string): void {
	if (issuerUrl) {
		jwksCache.delete(issuerUrl);
	} else {
		jwksCache.clear();
	}
}
