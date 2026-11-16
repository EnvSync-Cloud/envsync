import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from "jose";

import { AppError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";

type RemoteJwks = ReturnType<typeof createRemoteJWKSet>;

/** Fields verifyOidcToken reads. Extra columns on the row are ignored. */
export interface OidcProviderMatch {
	id: string;
	issuer_url: string;
	audience: string;
	enabled: boolean;
	allowed_subjects: unknown;
	machine_user_id?: string | null;
}

const DISCOVERY_TIMEOUT_MS = 5_000;
const DISCOVERY_MAX_BYTES = 1_000_000;
// Escape every regex metacharacter. `*` is applied afterwards and is the only wildcard.
const REGEX_METACHAR = /[.+?^${}()|[\]\\]/g;

/**
 * Discovered JWKS URI and the remote key set, keyed by normalized issuer.
 * There is no per-provider JWKS column; discovery is the only source.
 */
const jwksUriCache = new Map<string, string>();
const jwksSetCache = new Map<string, RemoteJwks>();
const discoveryInflight = new Map<string, Promise<string>>();

/**
 * Known CI/CD provider issuer URLs for quick detection.
 * Used by the auth middleware to decide if a Bearer token might be an OIDC token.
 */
export const KNOWN_OIDC_ISSUERS: readonly string[] = [
	"https://token.actions.githubusercontent.com",
	"https://gitlab.com",
];

/** Strip trailing slashes, queries, and default ports so issuer equality is stable. */
export function normalizeOidcIssuerUrl(issuerUrl: string): string {
	let url: URL;
	try {
		url = new URL(issuerUrl.trim());
	} catch {
		throw new AppError("OIDC issuer URL is invalid", 401, "OIDC_INVALID_ISSUER");
	}
	if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
		throw new AppError("OIDC issuer URL is invalid", 401, "OIDC_INVALID_ISSUER");
	}
	url.hash = "";
	url.search = "";
	const path = url.pathname.replace(/\/+$/, "");
	if (path === "" || path === "/") return url.origin;
	return `${url.origin}${path}`;
}

function tryNormalizeIssuer(issuerUrl: string): string | null {
	try {
		return normalizeOidcIssuerUrl(issuerUrl);
	} catch {
		return null;
	}
}

function discoveryUrlForIssuer(issuerKey: string): URL {
	// OIDC Discovery 1.0 appends this path. Do not guess /.well-known/jwks.json:
	// GitHub Actions publishes /.well-known/jwks and GitLab publishes /oauth/discovery/keys.
	return new URL(`${issuerKey}/.well-known/openid-configuration`);
}

function failDiscovery(issuerKey: string, detail: string): never {
	infoLogs(`OIDC discovery failed for issuer=${issuerKey}: ${detail}`, LogTypes.ERROR, "OIDC:DISCOVERY");
	throw new AppError("OIDC discovery failed", 401, "OIDC_DISCOVERY_FAILED");
}

async function discoverJwksUri(issuerKey: string): Promise<string> {
	let response: Response;
	try {
		response = await fetch(discoveryUrlForIssuer(issuerKey), {
			method: "GET",
			redirect: "error",
			cache: "no-store",
			headers: { accept: "application/json" },
			signal: AbortSignal.timeout(DISCOVERY_TIMEOUT_MS),
		});
	} catch (err) {
		failDiscovery(issuerKey, err instanceof Error ? err.message : "request failed");
	}
	if (!response.ok) {
		failDiscovery(issuerKey, `HTTP ${response.status}`);
	}

	let parsed: unknown;
	try {
		const text = await response.text();
		if (text.length === 0 || text.length > DISCOVERY_MAX_BYTES) {
			throw new Error("discovery document is empty or too large");
		}
		parsed = JSON.parse(text);
	} catch (err) {
		failDiscovery(issuerKey, err instanceof Error ? err.message : "invalid discovery document");
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		failDiscovery(issuerKey, "discovery document is not an object");
	}
	const document = parsed as { issuer?: unknown; jwks_uri?: unknown };
	if (typeof document.issuer !== "string" || tryNormalizeIssuer(document.issuer) !== issuerKey) {
		failDiscovery(issuerKey, "discovery issuer does not match");
	}
	if (typeof document.jwks_uri !== "string" || document.jwks_uri.length === 0) {
		failDiscovery(issuerKey, "discovery document is missing jwks_uri");
	}

	let jwksUrl: URL;
	try {
		jwksUrl = new URL(document.jwks_uri);
	} catch {
		failDiscovery(issuerKey, "jwks_uri is not an absolute URL");
	}
	if ((jwksUrl.protocol !== "https:" && jwksUrl.protocol !== "http:") || jwksUrl.username || jwksUrl.password) {
		failDiscovery(issuerKey, "jwks_uri scheme is not allowed");
	}
	// An https issuer must not downgrade signature verification onto cleartext HTTP.
	if (new URL(issuerKey).protocol === "https:" && jwksUrl.protocol !== "https:") {
		failDiscovery(issuerKey, "jwks_uri must use https");
	}
	return jwksUrl.href;
}

/**
 * Resolve and cache the JWKS URI published by the issuer's discovery document.
 * Fails closed. There is no fallback to `/.well-known/jwks.json`.
 */
export async function resolveOidcJwksUri(issuerUrl: string): Promise<string> {
	const issuerKey = normalizeOidcIssuerUrl(issuerUrl);
	const cached = jwksUriCache.get(issuerKey);
	if (cached) return cached;

	const pending = discoveryInflight.get(issuerKey);
	if (pending) return pending;

	const task = discoverJwksUri(issuerKey)
		.then(uri => {
			jwksUriCache.set(issuerKey, uri);
			return uri;
		})
		.finally(() => {
			discoveryInflight.delete(issuerKey);
		});
	discoveryInflight.set(issuerKey, task);
	return task;
}

async function getJwksForIssuer(issuerUrl: string): Promise<RemoteJwks> {
	const issuerKey = normalizeOidcIssuerUrl(issuerUrl);
	const cached = jwksSetCache.get(issuerKey);
	if (cached) return cached;
	const jwksUri = await resolveOidcJwksUri(issuerKey);
	const existing = jwksSetCache.get(issuerKey);
	if (existing) return existing;
	const jwks = createRemoteJWKSet(new URL(jwksUri));
	jwksSetCache.set(issuerKey, jwks);
	return jwks;
}

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
 * (i.e., not from Atrium). This is a heuristic — it decodes the JWT header
 * without verification and checks the issuer.
 */
export function mightBeOidcToken(bearerToken: string, directoryIssuer: string): boolean {
	const iss = decodeTokenIssuer(bearerToken);
	if (!iss) return false;
	if (iss === directoryIssuer) return false;
	// Any issuer other than Atrium could be a customer OIDC provider
	return true;
}

export interface OidcVerifiedPayload extends JWTPayload {
	iss: string;
	sub: string;
	aud: string | string[];
}

function readAllowedSubjects(value: unknown): string[] {
	let parsed = value;
	for (let attempt = 0; attempt < 2 && typeof parsed === "string"; attempt++) {
		try {
			parsed = JSON.parse(parsed);
		} catch {
			return [];
		}
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function subjectMatches(pattern: string, subject: string): boolean {
	const escaped = pattern.replace(REGEX_METACHAR, "\\$&").replaceAll("*", ".*");
	return new RegExp(`^${escaped}$`).test(subject);
}

function enabledProvidersForIssuer<T extends OidcProviderMatch>(
	providers: readonly T[],
	issuerKey: string,
): T[] {
	return providers.filter(provider => {
		if (!provider.enabled) return false;
		return tryNormalizeIssuer(provider.issuer_url) === issuerKey;
	});
}

/**
 * Verify an OIDC JWT against a registered provider.
 *
 * Flow:
 * 1. Decode (unverified) to get issuer → match against registered providers
 * 2. Fail closed when more than one enabled provider shares that issuer
 * 3. Verify signature against the JWKS URI from OIDC discovery
 * 4. Validate issuer and audience claims
 * 5. Reject when allowed_subjects is missing or empty, then glob-match the subject
 *
 * @returns The verified JWT payload
 */
export async function verifyOidcToken<T extends OidcProviderMatch>(
	bearerToken: string,
	providers: readonly T[],
): Promise<{ payload: OidcVerifiedPayload; provider: T }> {
	const token = bearerToken.replace(/^Bearer\s+/i, "");

	const unverifiedIss = decodeTokenIssuer(token);
	if (!unverifiedIss) {
		throw new AppError("OIDC token missing issuer claim", 401, "OIDC_MISSING_ISSUER");
	}
	const issuerKey = tryNormalizeIssuer(unverifiedIss);
	if (!issuerKey) {
		throw new AppError("OIDC token issuer is invalid", 401, "OIDC_INVALID_ISSUER");
	}

	const matches = enabledProvidersForIssuer(providers, issuerKey);
	if (matches.length === 0) {
		throw new AppError(
			`No OIDC provider registered for issuer: ${unverifiedIss}`,
			401,
			"OIDC_NO_PROVIDER",
		);
	}
	if (matches.length > 1) {
		throw new AppError(
			"Multiple enabled OIDC providers match this issuer",
			401,
			"OIDC_AMBIGUOUS_ISSUER",
		);
	}
	const provider = matches[0]!;

	const jwks = await getJwksForIssuer(provider.issuer_url);

	let payload: JWTPayload;
	try {
		const result = await jwtVerify(token, jwks, {
			issuer: unverifiedIss,
			algorithms: ["RS256", "ES256"],
		});
		payload = result.payload;
	} catch (err) {
		infoLogs(
			`OIDC JWT verification failed for issuer=${issuerKey}: ${err instanceof Error ? err.message : String(err)}`,
			LogTypes.ERROR,
			"OIDC:VERIFY",
		);
		throw new AppError("OIDC token verification failed", 401, "OIDC_VERIFY_FAILED");
	}

	if (typeof payload.iss !== "string" || tryNormalizeIssuer(payload.iss) !== issuerKey) {
		throw new AppError("OIDC token issuer mismatch", 401, "OIDC_VERIFY_FAILED");
	}

	const aud = payload.aud;
	const audArray = Array.isArray(aud) ? aud : [aud];
	if (!audArray.includes(provider.audience)) {
		throw new AppError(
			"OIDC token audience does not match expected value",
			401,
			"OIDC_AUDIENCE_MISMATCH",
		);
	}

	if (!payload.sub) {
		throw new AppError("OIDC token missing subject claim", 401, "OIDC_MISSING_SUB");
	}

	const allowedSubjects = readAllowedSubjects(provider.allowed_subjects);
	if (allowedSubjects.length === 0) {
		throw new AppError("OIDC provider has no allowed subjects", 401, "OIDC_EMPTY_ALLOWLIST");
	}

	const subjectAllowed = allowedSubjects.some(pattern => subjectMatches(pattern, payload.sub ?? ""));
	if (!subjectAllowed) {
		throw new AppError("OIDC token subject not in allowed list", 401, "OIDC_SUBJECT_NOT_ALLOWED");
	}

	return {
		payload: payload as OidcVerifiedPayload,
		provider,
	};
}

/**
 * Clear cached discovery URIs and JWKS sets for one issuer, or all issuers.
 */
export function clearJwksCache(issuerUrl?: string): void {
	if (!issuerUrl) {
		jwksUriCache.clear();
		jwksSetCache.clear();
		return;
	}
	const issuerKey = tryNormalizeIssuer(issuerUrl) ?? issuerUrl;
	jwksUriCache.delete(issuerKey);
	jwksSetCache.delete(issuerKey);
	jwksUriCache.delete(issuerUrl);
	jwksSetCache.delete(issuerUrl);
}
