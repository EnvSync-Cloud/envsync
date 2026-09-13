import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";

import { inflateRawSync } from "node:zlib";

import { issueSamlSessionToken, samlSessionSecret } from "@/helpers/access";
import { deflateAndEncode, signRelayState, verifyRelayState } from "@/helpers/saml";
import { CacheClient } from "@/libs/cache";
import { AppError } from "@/libs/errors";
import { config } from "@/utils/env";
import { testRequest } from "../helpers/request";
import { cleanupDB, seedOrg } from "../helpers/db";
import { resetFGA } from "../helpers/fga";
import { DB } from "@/libs/db";

const FAKE_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDpzCCAo+gAwIBAgIBADANBgkqhkiG9w0BAQUFADBxMQswCQYDVQQGEwJ1czEL
MAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFTATBgNVBAoMDEV4
YW1wbGUgSW5jLjEaMBgGA1UEAwwRZXhhbXBsZS5jb20gdGVzdDAeFw0yNTAxMDEw
MDAwMDBaFw0zNTAxMDEwMDAwMDBaMHExCzAJBgNVBAYTAnVzMQswCQYDVQQIDAJD
QTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEVMBMGA1UECgwMRXhhbXBsZSBJbmMu
MRowGAYDVQQDDB1leGFtcGxlLmNvbSB0ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWep4PAtGoRBh2kJGfRgMYwTh4ZGM+0
-----END CERTIFICATE-----`;

async function insertProvider(orgId: string, overrides?: { enabled?: boolean; isDefault?: boolean }) {
	const db = await DB.getInstance();
	const id = randomUUID();
	await db
		.insertInto("saml_providers")
		.values({
			id,
			org_id: orgId,
			provider_type: "okta",
			name: "Mock Okta",
			entity_id: `http://www.okta.com/exk-${id}`,
			sso_url: "https://example.okta.com/app/exk/sso/saml",
			certificate: FAKE_CERTIFICATE,
			enabled: overrides?.enabled ?? true,
			is_default: overrides?.isDefault ?? false,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();
	return id;
}

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
});

afterEach(async () => {
	await cleanupDB();
	resetFGA();
});

describe("public SAML routes", () => {
	test("POST start with missing org returns the same 404 body", async () => {
		const res = await testRequest("/api/saml/sso/does-not-exist", {
			method: "POST",
			body: {},
		});
		expect(res.status).toBe(404);
		expect(await res.json<{ error: string; code: string }>()).toEqual({
			error: "SSO is not available for this organization.",
			code: "SSO_NOT_AVAILABLE",
		});
	});

	test("POST start with zero enabled IdPs returns the same 404 body", async () => {
		const seed = await seedOrg();
		const res = await testRequest(`/api/saml/sso/${seed.org.slug}`, {
			method: "POST",
			body: {},
		});
		expect(res.status).toBe(404);
		expect(await res.json<{ error: string; code: string }>()).toEqual({
			error: "SSO is not available for this organization.",
			code: "SSO_NOT_AVAILABLE",
		});
	});

	test("GET start failure redirects to dashboard login", async () => {
		const res = await testRequest("/api/saml/sso/does-not-exist");
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("http://app.lvh.me:8001/login?sso=failed");
	});

	test("POST start with one enabled provider returns redirect_url and stores pending authn", async () => {
		const seed = await seedOrg();
		await insertProvider(seed.org.id);
		const res = await testRequest(`/api/saml/sso/${seed.org.slug}`, {
			method: "POST",
			body: {},
		});
		expect(res.status).toBe(200);
		const body = await res.json<{ redirect_url: string; request_id: string }>();
		expect(body.redirect_url).toContain("SAMLRequest=");
		expect(body.redirect_url).toContain("RelayState=");
		expect(body.request_id.startsWith("_")).toBe(true);
		const requestParam = new URL(body.redirect_url).searchParams.get("SAMLRequest");
		expect(requestParam).toBeTruthy();
		const inflated = inflateRawSync(Buffer.from(requestParam ?? "", "base64")).toString("utf8");
		expect(inflated).toContain("<samlp:AuthnRequest");
		expect(inflated).toContain(body.request_id);
	});

	test("deflateAndEncode is raw DEFLATE then base64, not zlib or plain btoa", () => {
		const xml = "<samlp:AuthnRequest>ok</samlp:AuthnRequest>";
		const encoded = deflateAndEncode(xml);
		expect(encoded).not.toBe(Buffer.from(xml, "utf8").toString("base64"));
		expect(inflateRawSync(Buffer.from(encoded, "base64")).toString("utf8")).toBe(xml);
	});

	test("GET public metadata for unknown org returns the same 404 body", async () => {
		const res = await testRequest(`/api/saml/metadata/${randomUUID()}`);
		expect(res.status).toBe(404);
		expect(await res.json<{ error: string; code: string }>()).toEqual({
			error: "SSO is not available for this organization.",
			code: "SSO_NOT_AVAILABLE",
		});
	});

	test("GET public metadata for an entitled org returns XML", async () => {
		const seed = await seedOrg();
		const res = await testRequest(`/api/saml/metadata/${seed.org.id}`);
		expect(res.status).toBe(200);
		const xml = await res.text();
		expect(xml).toContain("EntityDescriptor");
		expect(xml).toContain(`/api/saml/acs/${seed.org.id}`);
	});

	test("manage ACS is not an unauthenticated IdP endpoint", async () => {
		const res = await testRequest(`/api/v1/manage/saml/acs/${randomUUID()}`, {
			method: "POST",
			body: { SAMLResponse: "dGVzdA==" },
		});
		expect(res.status).toBe(401);
		expect(res.headers.get("location")).toBeNull();
	});

	test("ACS without RelayState is 401", async () => {
		const seed = await seedOrg();
		const res = await testRequest(`/api/saml/acs/${seed.org.id}`, {
			method: "POST",
			body: { SAMLResponse: "dGVzdA==" },
		});
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ code: "SAML_ACS_FAILED" });
	});

	test("ACS with invalid RelayState HMAC is 401", async () => {
		const seed = await seedOrg();
		const res = await testRequest(`/api/saml/acs/${seed.org.id}`, {
			method: "POST",
			body: { SAMLResponse: "dGVzdA==", RelayState: "not-a-valid.mac" },
		});
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ code: "SAML_ACS_FAILED" });
	});

	test("ACS GETDEL miss is 401", async () => {
		const seed = await seedOrg();
		const providerId = randomUUID();
		const relayState = signRelayState(
			{ v: 1, rid: "_missing", org: seed.org.id, pid: providerId },
			samlSessionSecret(),
		);
		const res = await testRequest(`/api/saml/acs/${seed.org.id}`, {
			method: "POST",
			body: { SAMLResponse: "dGVzdA==", RelayState: relayState },
		});
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ code: "SAML_ACS_FAILED" });
	});
});

describe("SAML RelayState binding", () => {
	test("sign and verify round-trip", () => {
		const payload = { v: 1 as const, rid: "_abc", org: "org-1", pid: "pid-1" };
		const token = signRelayState(payload, "secret");
		expect(verifyRelayState(token, "secret")).toEqual(payload);
	});

	test("rejects a tampered MAC", () => {
		const token = signRelayState({ v: 1, rid: "_abc", org: "org-1", pid: "pid-1" }, "secret");
		expect(() => verifyRelayState(`${token}ff`, "secret")).toThrow("Invalid RelayState");
	});
});

describe("SAML session cookies", () => {
	test("whoami labels a SAML cookie session as saml and pins memberships", async () => {
		const seed = await seedOrg();
		const token = await issueSamlSessionToken({
			userId: seed.masterUser.id,
			email: seed.masterUser.email,
			orgId: seed.org.id,
		});

		const res = await testRequest("/api/auth/me", {
			headers: { Cookie: `access_token=${token}` },
		});
		expect(res.status).toBe(200);
		const body = await res.json<{ auth_type: string; memberships: Array<{ org_id: string }> }>();
		expect(body.auth_type).toBe("saml");
		expect(body.memberships).toHaveLength(1);
		expect(body.memberships[0]?.org_id).toBe(seed.org.id);
	});

	test("switch-org is pinned for SAML sessions", async () => {
		const seed = await seedOrg();
		const token = await issueSamlSessionToken({
			userId: seed.masterUser.id,
			email: seed.masterUser.email,
			orgId: seed.org.id,
		});

		const res = await testRequest("/api/auth/switch-org", {
			method: "POST",
			headers: {
				Cookie: `access_token=${token}`,
				"X-CSRF-Token": "test",
			},
			body: { org_id: randomUUID() },
		});
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "AUTH_SSO_ORG_PINNED" });
	});

	test("logout peeks SAML and returns dashboard /login", async () => {
		const seed = await seedOrg();
		const token = await issueSamlSessionToken({
			userId: seed.masterUser.id,
			email: seed.masterUser.email,
			orgId: seed.org.id,
		});

		const res = await testRequest("/api/access/web/logout", {
			method: "POST",
			headers: { Cookie: `access_token=${token}` },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			logoutUrl: "http://app.lvh.me:8001/login",
		});
	});

	test("production refuses a missing SAML_SESSION_SECRET", () => {
		const originalEnv = config.NODE_ENV;
		const originalSecret = config.SAML_SESSION_SECRET;
		try {
			(config as { NODE_ENV: string }).NODE_ENV = "production";
			(config as { SAML_SESSION_SECRET?: string }).SAML_SESSION_SECRET = undefined;
			delete process.env.SAML_SESSION_SECRET;
			expect(() => samlSessionSecret()).toThrow(AppError);
			try {
				samlSessionSecret();
			} catch (err) {
				expect(err).toMatchObject({ code: "SAML_SESSION_SECRET_MISSING" });
			}
		} finally {
			(config as { NODE_ENV: string }).NODE_ENV = originalEnv;
			(config as { SAML_SESSION_SECRET?: string }).SAML_SESSION_SECRET = originalSecret;
		}
	});
});

describe("Cache GETDEL", () => {
	test("getdel returns the value once", async () => {
		await CacheClient.set("es:saml:authn:test", JSON.stringify({ ok: true }), 60);
		expect(await CacheClient.getdel("es:saml:authn:test")).toBe(JSON.stringify({ ok: true }));
		expect(await CacheClient.getdel("es:saml:authn:test")).toBeNull();
	});
});
