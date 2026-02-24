import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples, MockFGAClient } from "../helpers/fga";
import { resetPKI } from "../helpers/kms";

let seed: SeedOrgResult;
let viewerToken: string;
let viewerUserId: string;

// State shared across sequential test groups
let caSerialHex: string;
let caCertId: string;
let memberSerialHex: string;
let memberCertId: string;

beforeAll(async () => {
	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});

	const viewer = await seedUser(seed.org.id, seed.roles.viewer.id);
	viewerToken = viewer.token;
	viewerUserId = viewer.id;
	setupUserOrgTuples(viewer.id, seed.org.id, {
		can_view: true,
	});
});

// ─── Init CA ────────────────────────────────────────────────────────

describe("POST /api/certificate/ca/init", () => {
	test("master initializes org CA (201)", async () => {
		const res = await testRequest("/api/certificate/ca/init", {
			method: "POST",
			token: seed.masterUser.token,
			body: { org_name: seed.org.name },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			serial_hex: string;
			cert_type: string;
			cert_pem: string;
			status: string;
		}>();
		expect(body.id).toBeDefined();
		expect(body.serial_hex).toBeDefined();
		expect(body.cert_type).toBe("org_ca");
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
		expect(body.status).toBe("active");

		caCertId = body.id;
		caSerialHex = body.serial_hex;
	});

	test("viewer denied init (403)", async () => {
		const res = await testRequest("/api/certificate/ca/init", {
			method: "POST",
			token: viewerToken,
			body: { org_name: "Should Fail" },
		});
		expect(res.status).toBe(403);
	});

	test("duplicate init returns 409 (conflict)", async () => {
		const res = await testRequest("/api/certificate/ca/init", {
			method: "POST",
			token: seed.masterUser.token,
			body: { org_name: seed.org.name },
		});
		expect(res.status).toBe(409);
		const body = await res.json<{ error: string; code: string }>();
		expect(body.code).toBe("CONFLICT");
	});
});

// ─── Get CA ─────────────────────────────────────────────────────────

describe("GET /api/certificate/ca", () => {
	test("master sees org CA (200)", async () => {
		const res = await testRequest("/api/certificate/ca", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ cert_type: string; status: string }>();
		expect(body.cert_type).toBe("org_ca");
		expect(body.status).toBe("active");
	});

	test("viewer with can_view sees CA (200)", async () => {
		const res = await testRequest("/api/certificate/ca", {
			token: viewerToken,
		});
		expect(res.status).toBe(200);
	});
});

// ─── Root CA ────────────────────────────────────────────────────────

describe("GET /api/certificate/root-ca", () => {
	test("any authenticated user gets root CA (200)", async () => {
		const res = await testRequest("/api/certificate/root-ca", {
			token: viewerToken,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ cert_pem: string }>();
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
	});
});

// ─── Issue cert ─────────────────────────────────────────────────────

describe("POST /api/certificate/issue", () => {
	test("master issues member cert (201)", async () => {
		const res = await testRequest("/api/certificate/issue", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				member_email: "dev@example.com",
				role: "developer",
				description: "Test member cert",
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
		expect(body.id).toBeDefined();
		expect(body.serial_hex).toBeDefined();
		expect(body.cert_type).toBe("member");
		expect(body.cert_pem).toContain("BEGIN CERTIFICATE");
		expect(body.key_pem).toContain("BEGIN EC PRIVATE KEY");

		memberCertId = body.id;
		memberSerialHex = body.serial_hex;
	});

	test("viewer denied issue (403)", async () => {
		const res = await testRequest("/api/certificate/issue", {
			method: "POST",
			token: viewerToken,
			body: {
				member_email: "fail@example.com",
				role: "viewer",
			},
		});
		expect(res.status).toBe(403);
	});
});

// ─── List certs ─────────────────────────────────────────────────────

describe("GET /api/certificate", () => {
	test("master lists certificates (200, >= 2)", async () => {
		const res = await testRequest("/api/certificate", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});

	test("viewer lists certificates (200)", async () => {
		const res = await testRequest("/api/certificate", {
			token: viewerToken,
		});
		expect(res.status).toBe(200);
	});
});

// ─── FGA tuples ─────────────────────────────────────────────────────

describe("Certificate FGA tuples", () => {
	test("org CA has org and owner tuples", async () => {
		const tuples = await MockFGAClient.readTuples({ object: `certificate:${caCertId}` });
		const relations = tuples.map((t) => t.relation);
		expect(relations).toContain("org");
		expect(relations).toContain("owner");

		const orgTuple = tuples.find((t) => t.relation === "org");
		expect(orgTuple?.user).toBe(`org:${seed.org.id}`);

		const ownerTuple = tuples.find((t) => t.relation === "owner");
		expect(ownerTuple?.user).toBe(`user:${seed.masterUser.id}`);
	});

	test("member cert has org and owner tuples", async () => {
		const tuples = await MockFGAClient.readTuples({ object: `certificate:${memberCertId}` });
		const relations = tuples.map((t) => t.relation);
		expect(relations).toContain("org");
		expect(relations).toContain("owner");
	});
});

// ─── Revoke ─────────────────────────────────────────────────────────

describe("POST /api/certificate/:serial_hex/revoke", () => {
	test("master revokes cert (200)", async () => {
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

	test("viewer denied revoke (403)", async () => {
		const res = await testRequest(`/api/certificate/${caSerialHex}/revoke`, {
			method: "POST",
			token: viewerToken,
			body: { reason: 0 },
		});
		expect(res.status).toBe(403);
	});
});

// ─── OCSP ───────────────────────────────────────────────────────────

describe("GET /api/certificate/:serial_hex/ocsp", () => {
	test("revoked cert returns status revoked", async () => {
		const res = await testRequest(`/api/certificate/${memberSerialHex}/ocsp`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ status: string; revoked_at: string | null }>();
		expect(body.status).toBe("revoked");
		expect(body.revoked_at).toBeTruthy();
	});
});

// ─── CRL ────────────────────────────────────────────────────────────

describe("GET /api/certificate/crl", () => {
	test("master gets CRL (200)", async () => {
		const res = await testRequest("/api/certificate/crl", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ crl_pem: string; crl_number: number; is_delta: boolean }>();
		expect(body.crl_pem).toContain("BEGIN X509 CRL");
		expect(body.crl_number).toBe(1);
		expect(body.is_delta).toBe(false);
	});

	test("viewer gets CRL (200)", async () => {
		const res = await testRequest("/api/certificate/crl", {
			token: viewerToken,
		});
		expect(res.status).toBe(200);
	});
});
