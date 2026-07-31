import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { importPKCS8, SignJWT } from "jose";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { EntitlementService } from "@/services/entitlement.service";
import type { EnterpriseFeature } from "@/services/entitlement.types";

const FIXTURE_DIR = path.join(import.meta.dir, "../fixtures/license");
const PRIVATE_PEM = fs.readFileSync(path.join(FIXTURE_DIR, "entitlement-private.pem"), "utf8");
const PUBLIC_PEM = fs.readFileSync(path.join(FIXTURE_DIR, "entitlement-public.pem"), "utf8");

const FINGERPRINT = "test-install-fp-p4";

async function signEntitlement(claims: {
	features?: EnterpriseFeature[];
	max_orgs?: number;
	install_fingerprint?: string;
	exp?: number;
	nbf?: number;
}) {
	const key = await importPKCS8(PRIVATE_PEM, "EdDSA");
	const now = Math.floor(Date.now() / 1000);
	return new SignJWT({
		ver: 1,
		install_fingerprint: claims.install_fingerprint ?? FINGERPRINT,
		edition: "enterprise",
		features: claims.features ?? ["management", "oidc", "saml"],
		max_orgs: claims.max_orgs,
	})
		.setProtectedHeader({ alg: "EdDSA" })
		.setIssuer("envsync-license-server")
		.setIssuedAt(now)
		.setExpirationTime(claims.exp ?? now + 3600)
		.setNotBefore(claims.nbf ?? now - 10)
		.sign(key);
}

beforeAll(() => {
	// config is already parsed; tests use EntitlementService overrides for key/JWT.
});

afterEach(() => {
	EntitlementService.clearTestOverrides();
	EntitlementService.clearCache();
	EditionPolicyService.clearTestOverrides();
});

describe("EntitlementService (Phase 4)", () => {
	test("verifies a valid Ed25519 entitlement JWT", async () => {
		const jwt = await signEntitlement({ max_orgs: 3, features: ["management", "multi_org", "oidc"] });
		EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });

		const verified = await EntitlementService.verifyJwt(jwt);
		expect(verified.source).toBe("jwt");
		expect(verified.claims.features).toContain("oidc");
		expect(verified.claims.max_orgs).toBe(3);
		expect(verified.in_grace).toBe(false);
	});

	test("rejects forged JWT signed with wrong key", async () => {
		// Generate a different key and sign with it; verify against fixture public key.
		const { generateKeyPair } = await import("jose");
		const { privateKey } = await generateKeyPair("EdDSA");
		const now = Math.floor(Date.now() / 1000);
		const forged = await new SignJWT({
			ver: 1,
			install_fingerprint: FINGERPRINT,
			features: ["management", "oidc"],
		})
			.setProtectedHeader({ alg: "EdDSA" })
			.setIssuer("envsync-license-server")
			.setIssuedAt(now)
			.setExpirationTime(now + 3600)
			.sign(privateKey);

		EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });
		await expect(EntitlementService.verifyJwt(forged)).rejects.toMatchObject({
			code: "ENTITLEMENT_INVALID",
		});
	});

	test("rejects fingerprint mismatch", async () => {
		const jwt = await signEntitlement({ install_fingerprint: "other-fp" });
		// Set install fingerprint via claims check against config — override JWT and key only;
		// EntitlementService reads config.ENVSYNC_INSTALL_FINGERPRINT. Mutate config for this test.
		const { config } = await import("@/utils/env");
		const original = config.ENVSYNC_INSTALL_FINGERPRINT;
		config.ENVSYNC_INSTALL_FINGERPRINT = FINGERPRINT;
		try {
			EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });
			await expect(EntitlementService.verifyJwt(jwt)).rejects.toMatchObject({
				code: "ENTITLEMENT_FINGERPRINT_MISMATCH",
			});
		} finally {
			config.ENVSYNC_INSTALL_FINGERPRINT = original;
		}
	});

	test("allows grace window after exp", async () => {
		const now = Math.floor(Date.now() / 1000);
		const jwt = await signEntitlement({ exp: now - 60 }); // expired 1 minute ago
		EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });
		// Default grace is 72h
		const verified = await EntitlementService.verifyJwt(jwt, { allowGrace: true });
		expect(verified.in_grace).toBe(true);
	});

	test("rejects past grace when allowGrace=false", async () => {
		const now = Math.floor(Date.now() / 1000);
		const jwt = await signEntitlement({ exp: now - 60 });
		EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });
		await expect(EntitlementService.verifyJwt(jwt, { allowGrace: false })).rejects.toMatchObject({
			code: "ENTITLEMENT_INVALID",
		});
	});

	test("hosted bypasses feature gates without entitlement", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
			license_enforcement: true,
		});
		await expect(EntitlementService.assertFeature("saml")).resolves.toBeUndefined();
	});

	test("oss always denies features", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "oss",
			deployment_mode: "selfhosted",
		});
		await expect(EntitlementService.assertFeature("oidc")).rejects.toMatchObject({
			code: "ENTERPRISE_FEATURE_REQUIRED",
		});
	});

	test("selfhost enforcement without entitlement denies features", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: true,
		});
		EntitlementService.setTestOverrides({ disable: true });
		await expect(EntitlementService.assertFeature("oidc")).rejects.toMatchObject({
			code: "ENTITLEMENT_REQUIRED",
		});
	});

	test("selfhost enforcement requires feature in claims", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: true,
		});
		EntitlementService.setTestOverrides({
			claims: {
				ver: 1,
				install_fingerprint: FINGERPRINT,
				edition: "enterprise",
				features: ["management", "oidc"],
			},
		});
		await expect(EntitlementService.assertFeature("oidc")).resolves.toBeUndefined();
		await expect(EntitlementService.assertFeature("saml")).rejects.toMatchObject({
			code: "ENTITLEMENT_FEATURE_MISSING",
		});
	});

	test("selfhost without enforcement allows edition-only (dev DX)", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: false,
		});
		EntitlementService.setTestOverrides({ disable: true });
		await expect(EntitlementService.assertFeature("rotation")).resolves.toBeUndefined();
	});

	test("max_orgs from multi_org / claims feeds EditionPolicy", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
		});
		EntitlementService.setTestOverrides({
			claims: {
				ver: 1,
				install_fingerprint: FINGERPRINT,
				edition: "enterprise",
				features: ["management", "multi_org"],
				max_orgs: 3,
			},
		});
		// Warm cache
		await EntitlementService.resolve();
		expect(EditionPolicyService.getMaxOrgs()).toBe(3);
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "selfhost_cli", orgCount: 2 }),
		).not.toThrow();
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "selfhost_cli", orgCount: 3 }),
		).toThrow(expect.objectContaining({ code: "ORG_LIMIT_REACHED" }));
		// Web still forbidden on self-host
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "hosted_dashboard", orgCount: 0 }),
		).toThrow(expect.objectContaining({ code: "ORG_CREATE_CHANNEL_FORBIDDEN" }));
	});

	test("default entitlement without multi_org is max_orgs=1", async () => {
		EntitlementService.setTestOverrides({
			claims: {
				ver: 1,
				install_fingerprint: FINGERPRINT,
				edition: "enterprise",
				features: ["management", "oidc"],
			},
		});
		await EntitlementService.resolve();
		expect(EntitlementService.getMaxOrgsFromEntitlement()).toBe(1);
	});

	test("policy snapshot includes entitlement fields", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: true,
		});
		EntitlementService.setTestOverrides({
			claims: {
				ver: 1,
				install_fingerprint: FINGERPRINT,
				edition: "enterprise",
				features: ["management", "saml"],
				max_orgs: 1,
			},
		});
		await EntitlementService.resolve();
		const snap = EditionPolicyService.getPolicySnapshot();
		expect(snap.license_enforcement).toBe(true);
		expect(snap.entitlement.present).toBe(true);
		expect(snap.entitlement.features).toContain("saml");
	});
});

describe("enterpriseGuard middleware (feature)", () => {
	test("blocks OSS on feature middleware", async () => {
		const { Hono } = await import("hono");
		const { enterpriseGuard } = await import("@/middlewares/enterprise.middleware");
		const { ForbiddenError } = await import("@/libs/errors");

		EditionPolicyService.setTestOverrides({ edition: "oss", deployment_mode: "selfhosted" });

		const app = new Hono();
		app.onError((err, c) => {
			if (err instanceof ForbiddenError) {
				return c.json({ code: err.code, error: err.message }, 403);
			}
			throw err;
		});
		app.use("/api/oidc/*", enterpriseGuard("oidc"));
		app.get("/api/oidc/x", c => c.json({ ok: true }));

		const res = await app.request("http://localhost/api/oidc/x");
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "ENTERPRISE_FEATURE_REQUIRED" });
	});

	test("allows entitled feature when enforcement is on", async () => {
		const { Hono } = await import("hono");
		const { enterpriseGuard } = await import("@/middlewares/enterprise.middleware");

		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: true,
		});
		EntitlementService.setTestOverrides({
			claims: {
				ver: 1,
				install_fingerprint: FINGERPRINT,
				edition: "enterprise",
				features: ["oidc", "management"],
			},
		});

		const app = new Hono();
		app.use("/api/oidc/*", enterpriseGuard("oidc"));
		app.get("/api/oidc/x", c => c.json({ ok: true }));

		const res = await app.request("http://localhost/api/oidc/x");
		expect(res.status).toBe(200);
	});
});
