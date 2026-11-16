import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

import { clearJwksCache, resolveOidcJwksUri, verifyOidcToken } from "@/helpers/oidc";

import type { Selectable } from "kysely";
import type { JWK } from "jose";
import type { Database } from "@/types/db";

type OidcProviderRow = Selectable<Database["oidc_providers"]>;
type SigningKey = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_JWKS = "https://token.actions.githubusercontent.com/.well-known/jwks";
const GITLAB_ISSUER = "https://gitlab.com";
const GITLAB_JWKS = "https://gitlab.com/oauth/discovery/keys";
const AUDIENCE = "https://envsync.cloud";
const DOT_PATTERN = "repo:myorg/my.repo:*";
const DOT_SUBJECT = "repo:myorg/my.repo:ref";
const METACHAR_SUBJECT = "repo:myorg/myXrepo:foo";

const originalFetch = globalThis.fetch;

let privateKey: SigningKey;
let publicJwk: JWK;

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

function installFetch(handlers: Record<string, () => Response>): string[] {
	const calls: string[] = [];
	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = requestUrl(input);
		calls.push(url);
		const handler = handlers[url];
		if (!handler) return new Response("not found", { status: 404 });
		return handler();
	}) as typeof fetch;
	return calls;
}

function discoveryDocument(issuer: string, jwksUri: string, jwk?: JWK): Record<string, () => Response> {
	return {
		[`${issuer}/.well-known/openid-configuration`]: () => Response.json({ issuer, jwks_uri: jwksUri }),
		[jwksUri]: () => Response.json({ keys: jwk ? [jwk] : [] }),
	};
}

function provider(overrides: Partial<OidcProviderRow> = {}): OidcProviderRow {
	return {
		id: "provider-1",
		org_id: "org-1",
		provider_type: "github_actions",
		issuer_url: GITHUB_ISSUER,
		audience: AUDIENCE,
		enabled: true,
		allowed_subjects: [DOT_PATTERN],
		machine_user_id: "machine-1",
		created_at: new Date("2026-01-01T00:00:00Z"),
		updated_at: new Date("2026-01-01T00:00:00Z"),
		...overrides,
	};
}

function unsignedJwt(payload: Record<string, unknown>): string {
	const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
	const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${header}.${body}.c2ln`;
}

async function signedToken(claims: { iss: string; sub: string; aud?: string }): Promise<string> {
	return new SignJWT({})
		.setProtectedHeader({ alg: "RS256", kid: "test-key", typ: "JWT" })
		.setIssuer(claims.iss)
		.setAudience(claims.aud ?? AUDIENCE)
		.setSubject(claims.sub)
		.setIssuedAt()
		.setExpirationTime("2m")
		.sign(privateKey);
}

beforeAll(async () => {
	const keys = await generateKeyPair("RS256", { extractable: true });
	privateKey = keys.privateKey;
	publicJwk = await exportJWK(keys.publicKey);
	publicJwk.kid = "test-key";
	publicJwk.alg = "RS256";
	publicJwk.use = "sig";
});

afterEach(() => {
	clearJwksCache();
	globalThis.fetch = originalFetch;
});

describe("workload OIDC JWKS discovery", () => {
	test("GitHub Actions issuer resolves to /.well-known/jwks and caches it", async () => {
		const calls = installFetch(discoveryDocument(GITHUB_ISSUER, GITHUB_JWKS, publicJwk));

		await expect(resolveOidcJwksUri(GITHUB_ISSUER)).resolves.toBe(GITHUB_JWKS);
		await expect(resolveOidcJwksUri(`${GITHUB_ISSUER}/`)).resolves.toBe(GITHUB_JWKS);

		expect(calls).toEqual([`${GITHUB_ISSUER}/.well-known/openid-configuration`]);
		expect(calls.some(url => url.endsWith("/jwks.json"))).toBe(false);

		const token = await signedToken({ iss: GITHUB_ISSUER, sub: DOT_SUBJECT });
		const verified = await verifyOidcToken(token, [
			provider({ issuer_url: `${GITHUB_ISSUER}/`, allowed_subjects: [DOT_PATTERN] }),
		]);
		expect(verified.payload.sub).toBe(DOT_SUBJECT);
		expect(calls).toContain(GITHUB_JWKS);
		expect(calls.some(url => url.includes("jwks.json"))).toBe(false);
	});

	test("GitLab issuer resolves to /oauth/discovery/keys", async () => {
		const calls = installFetch(discoveryDocument(GITLAB_ISSUER, GITLAB_JWKS));

		await expect(resolveOidcJwksUri(GITLAB_ISSUER)).resolves.toBe(GITLAB_JWKS);
		expect(calls).toEqual([`${GITLAB_ISSUER}/.well-known/openid-configuration`]);
		expect(calls.some(url => url.includes("jwks.json"))).toBe(false);
	});

	test("an https issuer rejects a cleartext jwks_uri", async () => {
		const calls = installFetch({
			[`${GITHUB_ISSUER}/.well-known/openid-configuration`]: () =>
				Response.json({
					issuer: GITHUB_ISSUER,
					jwks_uri: "http://token.actions.githubusercontent.com/.well-known/jwks",
				}),
		});
		await expect(resolveOidcJwksUri(GITHUB_ISSUER)).rejects.toMatchObject({
			code: "OIDC_DISCOVERY_FAILED",
		});
		expect(calls.some(url => url.startsWith("http://"))).toBe(false);
	});

	test("discovery failure does not fall back to jwks.json", async () => {
		const calls = installFetch({});
		await expect(resolveOidcJwksUri(GITHUB_ISSUER)).rejects.toMatchObject({
			code: "OIDC_DISCOVERY_FAILED",
			statusCode: 401,
		});
		expect(calls).toEqual([`${GITHUB_ISSUER}/.well-known/openid-configuration`]);
	});
});

describe("workload OIDC issuer matching", () => {
	test("duplicate enabled issuers fail closed without fetching JWKS", async () => {
		globalThis.fetch = (() => {
			throw new Error("network should not be called");
		}) as unknown as typeof fetch;

		const token = unsignedJwt({ iss: GITHUB_ISSUER, sub: DOT_SUBJECT, aud: AUDIENCE });
		await expect(
			verifyOidcToken(token, [
				provider({ id: "provider-1", org_id: "org-1" }),
				provider({ id: "provider-2", org_id: "org-2" }),
			]),
		).rejects.toMatchObject({
			code: "OIDC_AMBIGUOUS_ISSUER",
			statusCode: 401,
		});
	});

	test("trailing-slash issuer variants are the same issuer and fail closed", async () => {
		globalThis.fetch = (() => {
			throw new Error("network should not be called");
		}) as unknown as typeof fetch;

		const token = unsignedJwt({ iss: `${GITLAB_ISSUER}/`, sub: "project_path:myorg/my.repo:ref", aud: AUDIENCE });
		await expect(
			verifyOidcToken(token, [
				provider({
					id: "provider-1",
					org_id: "org-1",
					provider_type: "gitlab_ci",
					issuer_url: GITLAB_ISSUER,
				}),
				provider({
					id: "provider-2",
					org_id: "org-2",
					provider_type: "gitlab_ci",
					issuer_url: `${GITLAB_ISSUER}/`,
				}),
			]),
		).rejects.toMatchObject({ code: "OIDC_AMBIGUOUS_ISSUER" });
	});

	test("a disabled duplicate does not make the issuer ambiguous", async () => {
		installFetch(discoveryDocument(GITHUB_ISSUER, GITHUB_JWKS, publicJwk));
		const token = await signedToken({ iss: GITHUB_ISSUER, sub: DOT_SUBJECT });
		const verified = await verifyOidcToken(token, [
			provider({ id: "provider-1", org_id: "org-1" }),
			provider({ id: "provider-2", org_id: "org-2", enabled: false }),
		]);
		expect(verified.provider.id).toBe("provider-1");
	});
});

describe("workload OIDC subject allowlist", () => {
	test("empty or missing allowed_subjects rejects a signed token", async () => {
		installFetch(discoveryDocument(GITHUB_ISSUER, GITHUB_JWKS, publicJwk));
		const token = await signedToken({ iss: GITHUB_ISSUER, sub: DOT_SUBJECT });

		for (const allowed_subjects of [[], null, "[]", "not-json", undefined]) {
			await expect(
				verifyOidcToken(token, [provider({ allowed_subjects: allowed_subjects as OidcProviderRow["allowed_subjects"] })]),
			).rejects.toMatchObject({
				code: "OIDC_EMPTY_ALLOWLIST",
				statusCode: 401,
			});
		}
	});

	test("a dot in a subject pattern is literal and only * is a wildcard", async () => {
		installFetch(discoveryDocument(GITHUB_ISSUER, GITHUB_JWKS, publicJwk));
		const allowed = provider({ allowed_subjects: [DOT_PATTERN] });

		const denied = await signedToken({ iss: GITHUB_ISSUER, sub: METACHAR_SUBJECT });
		await expect(verifyOidcToken(denied, [allowed])).rejects.toMatchObject({
			code: "OIDC_SUBJECT_NOT_ALLOWED",
		});

		const accepted = await signedToken({ iss: GITHUB_ISSUER, sub: DOT_SUBJECT });
		const verified = await verifyOidcToken(accepted, [allowed]);
		expect(verified.payload.sub).toBe(DOT_SUBJECT);
	});

	test("a JSON-encoded allowlist still treats regex metacharacters as literal", async () => {
		installFetch(discoveryDocument(GITLAB_ISSUER, GITLAB_JWKS, publicJwk));
		const allowed = provider({
			provider_type: "gitlab_ci",
			issuer_url: GITLAB_ISSUER,
			allowed_subjects: JSON.stringify([DOT_PATTERN]) as unknown as OidcProviderRow["allowed_subjects"],
		});

		const denied = await signedToken({ iss: GITLAB_ISSUER, sub: METACHAR_SUBJECT });
		await expect(verifyOidcToken(denied, [allowed])).rejects.toMatchObject({
			code: "OIDC_SUBJECT_NOT_ALLOWED",
		});

		const accepted = await signedToken({ iss: GITLAB_ISSUER, sub: DOT_SUBJECT });
		await expect(verifyOidcToken(accepted, [allowed])).resolves.toMatchObject({
			payload: { sub: DOT_SUBJECT },
		});
	});
});
