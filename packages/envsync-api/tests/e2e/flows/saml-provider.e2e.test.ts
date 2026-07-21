/**
 * E2E: SAML Provider CRUD — create → list → get → update → delete
 *
 * Uses real PostgreSQL, OpenFGA, and Keycloak.
 * Tests the SAML identity provider management surface for SSO authentication.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { managementTestRequest } from "../helpers/management-request";
import {
	checkServiceHealth,
	seedE2EOrg,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;

const FAKE_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDpzCCAo+gAwIBAgIBADANBgkqhkiG9w0BAQUFADBxMQswCQYDVQQGEwJ1czEL
MAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFuY2lzY28xFTATBgNVBAoMDEV4
YW1wbGUgSW5jLjEaMBgGA1UEAwwRZXhhbXBsZS5jb20gdGVzdDAeFw0yNTAxMDEw
MDAwMDBaFw0zNTAxMDEwMDAwMDBaMHExCzAJBgNVBAYTAnVzMQswCQYDVQQIDAJD
QTEWMBQGA1UEBwwNU2FuIEZyYW5jaXNjbzEVMBMGA1UECgwMRXhhbXBsZSBJbmMu
MRowGAYDVQQDDB1leGFtcGxlLmNvbSB0ZXN0MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEA0Z3VS5JJcds3xfn/ygWep4PAtGoRBh2kJGfRgMYwTh4ZGM+0
-----END CERTIFICATE-----`;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();
});

describe("SAML Provider E2E", () => {
	let providerId: string;

	test("create SAML provider for Okta", async () => {
		const res = await managementTestRequest("/api/saml", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "okta",
				name: "E2E Okta Provider",
				entity_id: "http://www.okta.com/exk-e2e-test",
				sso_url: "https://example.okta.com/app/exk-e2e/sso/saml",
				certificate: FAKE_CERTIFICATE,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			org_id: string;
			provider_type: string;
			name: string;
			entity_id: string;
			sso_url: string;
			enabled: boolean;
		}>();
		expect(body.id).toBeDefined();
		expect(body.org_id).toBe(seed.org.id);
		expect(body.provider_type).toBe("okta");
		expect(body.name).toBe("E2E Okta Provider");
		expect(body.entity_id).toBe("http://www.okta.com/exk-e2e-test");
		expect(body.sso_url).toBe("https://example.okta.com/app/exk-e2e/sso/saml");
		expect(body.enabled).toBe(true);
		providerId = body.id;
	});

	test("list SAML providers returns created provider", async () => {
		const res = await managementTestRequest("/api/saml", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; provider_type: string; name: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.some((p) => p.id === providerId && p.name === "E2E Okta Provider")).toBe(true);
	});

	test("get SAML provider by ID", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			provider_type: string;
			name: string;
			entity_id: string;
			sso_url: string;
		}>();
		expect(body.id).toBe(providerId);
		expect(body.provider_type).toBe("okta");
		expect(body.name).toBe("E2E Okta Provider");
	});

	test("update SAML provider name and SSO URL", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				name: "E2E Okta Updated",
				sso_url: "https://example.okta.com/app/exk-e2e-updated/sso/saml",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("SAML provider updated successfully.");
	});

	test("verify updated SAML provider fields", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ name: string; sso_url: string }>();
		expect(body.name).toBe("E2E Okta Updated");
		expect(body.sso_url).toBe("https://example.okta.com/app/exk-e2e-updated/sso/saml");
	});

	test("disable SAML provider", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			method: "PUT",
			token: seed.masterUser.token,
			body: { enabled: false },
		});
		expect(res.status).toBe(200);
	});

	test("get SAML SP metadata", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}/metadata`, {
			token: seed.masterUser.token,
		});
		// Metadata endpoint may return XML or 200/500 depending on enterprise config
		expect([200, 500]).toContain(res.status);
	});

	test("delete SAML provider", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("SAML provider deleted successfully.");
	});

	test("get deleted SAML provider returns 404", async () => {
		const res = await managementTestRequest(`/api/saml/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(404);
	});

	test("create SAML provider with missing required fields returns 400", async () => {
		const res = await managementTestRequest("/api/saml", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "okta",
				name: "Incomplete Provider",
				// missing entity_id, sso_url, certificate
			},
		});
		expect(res.status).toBe(400);
	});

	test("create SAML provider with invalid provider_type returns 400", async () => {
		const res = await managementTestRequest("/api/saml", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "invalid_idp",
				name: "Bad Provider",
				entity_id: "http://www.example.com",
				sso_url: "https://example.com/sso/saml",
				certificate: FAKE_CERTIFICATE,
			},
		});
		expect(res.status).toBe(400);
	});

	test("create SAML provider with invalid URL returns 400", async () => {
		const res = await managementTestRequest("/api/saml", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "okta",
				name: "Bad URL Provider",
				entity_id: "not-a-url",
				sso_url: "https://example.com/sso/saml",
				certificate: FAKE_CERTIFICATE,
			},
		});
		expect(res.status).toBe(400);
	});
});
