/**
 * E2E: GPG key REST API — generate → list → get → export → sign → verify → trust → revoke → delete
 *
 * Uses real PostgreSQL and OpenFGA.
 * Tests the full GPG key lifecycle via the REST API.
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

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });
});

describe("GPG REST API E2E", () => {
	let keyId: string;
	let signatureArmored: string;

	test("generate GPG key", async () => {
		const res = await testRequest("/api/gpg_key/generate", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				name: "E2E Test Key",
				email: "e2e-gpg@test.local",
				algorithm: "ecc-curve25519",
				usage_flags: ["sign"],
				expires_in_days: 365,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; fingerprint: string }>();
		expect(body.id).toBeDefined();
		expect(body.fingerprint).toBeDefined();
		keyId = body.id;
	});

	test("list GPG keys", async () => {
		const res = await testRequest("/api/gpg_key", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(1);

		const found = body.find((k: any) => k.id === keyId);
		expect(found).toBeDefined();
	});

	test("get GPG key by ID", async () => {
		const res = await testRequest(`/api/gpg_key/${keyId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBe(keyId);
		expect(body.name).toBe("E2E Test Key");
	});

	test("export GPG public key", async () => {
		const res = await testRequest(`/api/gpg_key/${keyId}/export`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ public_key: string }>();
		expect(body.public_key).toContain("PGP PUBLIC KEY");
	});

	test("sign data with GPG key", async () => {
		const res = await testRequest("/api/gpg_key/sign", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				key_id: keyId,
				data: "Hello, this is a test message to sign",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ signature: string }>();
		expect(body.signature).toBeDefined();
		signatureArmored = body.signature;
	});

	test("verify GPG signature", async () => {
		const res = await testRequest("/api/gpg_key/verify", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				key_id: keyId,
				data: "Hello, this is a test message to sign",
				signature: signatureArmored,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ valid: boolean }>();
		expect(body.valid).toBe(true);
	});

	test("update GPG key trust level", async () => {
		const res = await testRequest(`/api/gpg_key/${keyId}/trust`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				trust_level: "full",
			},
		});
		expect(res.status).toBe(200);
	});

	test("revoke GPG key", async () => {
		const res = await testRequest(`/api/gpg_key/${keyId}/revoke`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				reason: "Key compromised during testing",
			},
		});
		expect(res.status).toBe(200);
	});

	test("delete GPG key", async () => {
		const res = await testRequest(`/api/gpg_key/${keyId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("viewer cannot generate GPG keys (403)", async () => {
		const res = await testRequest("/api/gpg_key/generate", {
			method: "PUT",
			token: viewerUser.token,
			body: {
				name: "Should Fail",
				email: "fail@test.local",
				algorithm: "ecc-curve25519",
				usage_flags: ["sign"],
			},
		});
		expect(res.status).toBe(403);
	});
});
