import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { importPKCS8, SignJWT } from "jose";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { EntitlementService } from "@/services/entitlement.service";

const FIXTURE_DIR = path.join(import.meta.dir, "../fixtures/license");
const PRIVATE_PEM = fs.readFileSync(path.join(FIXTURE_DIR, "entitlement-private.pem"), "utf8");
const PUBLIC_PEM = fs.readFileSync(path.join(FIXTURE_DIR, "entitlement-public.pem"), "utf8");

afterEach(() => {
	EntitlementService.clearTestOverrides();
	EditionPolicyService.clearTestOverrides();
});

/**
 * H4: signed_lease shaped as entitlement JWT (as issued by license-server) unlocks features.
 */
describe("Entitlement from license-server signed_lease shape (H4)", () => {
	test("verifyJwt accepts license-server claim shape and assertFeature works under enforcement", async () => {
		const key = await importPKCS8(PRIVATE_PEM, "EdDSA");
		const now = Math.floor(Date.now() / 1000);
		const jwt = await new SignJWT({
			ver: 1,
			install_fingerprint: "install-fp-h4",
			edition: "enterprise",
			features: ["management", "integrations", "oidc"],
			max_orgs: 2,
			license_key: "envsync-enterprise-dev",
		})
			.setProtectedHeader({ alg: "EdDSA" })
			.setIssuer("envsync-license-server")
			.setSubject("install-fp-h4")
			.setIssuedAt(now)
			.setExpirationTime(now + 3600)
			.sign(key);

		EntitlementService.setTestOverrides({ public_key_pem: PUBLIC_PEM });
		const verified = await EntitlementService.verifyJwt(jwt);
		expect(verified.claims.features).toContain("integrations");
		expect(verified.claims.max_orgs).toBe(2);

		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			license_enforcement: true,
		});
		await expect(EntitlementService.assertFeature("integrations")).resolves.toBeUndefined();
		await expect(EntitlementService.assertFeature("saml")).rejects.toMatchObject({
			code: "ENTITLEMENT_FEATURE_MISSING",
		});
	});

	test("hosted still allows features without JWT under enforcement", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
			license_enforcement: true,
		});
		EntitlementService.setTestOverrides({ disable: true });
		await expect(EntitlementService.assertFeature("saml")).resolves.toBeUndefined();
	});
});
