/**
 * E2E: Certificate flow — init CA → issue → list → revoke → OCSP → CRL
 *
 * Uses real SpacetimeDB and Keycloak.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	seedE2EUser,
	setupE2EUserPermissions,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let viewerUser: { id: string; token: string };

// State shared across sequential tests
let memberSerialHex: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });
});

describe("Certificate Flow E2E", () => {
	test("1. master initializes org CA (201)", async () => {
		const res = await testRequest("/api/certificate/ca/init", {
			method: "POST",
			token: seed.masterUser.token,
			body: { org_name: seed.org.name },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; cert_type: string; cert_pem: string }>();
		expect(body.id).toBeDefined();
		expect(body.cert_type).toBe("org_ca");
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
	});

	test("2. viewer denied init (403)", async () => {
		const res = await testRequest("/api/certificate/ca/init", {
			method: "POST",
			token: viewerUser.token,
			body: { org_name: "Should Fail" },
		});
		expect(res.status).toBe(403);
	});

	test("3. master views org CA status (200)", async () => {
		const res = await testRequest("/api/certificate/ca", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ cert_type: string; status: string }>();
		expect(body.cert_type).toBe("org_ca");
		expect(body.status).toBe("active");
	});

	test("4. viewer gets root CA (200)", async () => {
		const res = await testRequest("/api/certificate/root-ca", {
			token: viewerUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ cert_pem: string }>();
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
	});

	test("5. master issues member cert (201)", async () => {
		const res = await testRequest("/api/certificate/issue", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				member_email: "e2e-dev@example.com",
				role: "developer",
				description: "E2E member cert",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			serial_hex: string;
			cert_type: string;
			cert_pem: string;
			key_pem: string;
		}>();
		expect(body.cert_type).toBe("member");
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
		expect(body.key_pem).toBeDefined();
		memberSerialHex = body.serial_hex;
	});

	test("6. viewer denied issue (403)", async () => {
		const res = await testRequest("/api/certificate/issue", {
			method: "POST",
			token: viewerUser.token,
			body: {
				member_email: "fail@example.com",
				role: "viewer",
			},
		});
		expect(res.status).toBe(403);
	});

	test("7. viewer lists certificates (200)", async () => {
		const res = await testRequest("/api/certificate", {
			token: viewerUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});

	test("8. master revokes member cert (200)", async () => {
		const res = await testRequest(`/api/certificate/${memberSerialHex}/revoke`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { reason: 0 },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ serial_hex: string; status: string }>();
		expect(body.serial_hex).toBe(memberSerialHex);
		expect(body.status).toBe("revoked");
	});

	test("9. viewer denied revoke (403)", async () => {
		const res = await testRequest(`/api/certificate/${memberSerialHex}/revoke`, {
			method: "POST",
			token: viewerUser.token,
			body: { reason: 0 },
		});
		expect(res.status).toBe(403);
	});

	test("10. OCSP on revoked cert returns revoked", async () => {
		const res = await testRequest(`/api/certificate/${memberSerialHex}/ocsp`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ status: string; revoked_at: string | null }>();
		expect(body.status).toBe("revoked");
		expect(body.revoked_at).toBeTruthy();
	});

	test("11. CRL retrieval (200)", async () => {
		const res = await testRequest("/api/certificate/crl", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ crl_pem: string; crl_number: number }>();
		expect(body.crl_pem).toContain("BEGIN X509 CRL");
		expect(body.crl_number).toBeGreaterThanOrEqual(1);
	});
});
