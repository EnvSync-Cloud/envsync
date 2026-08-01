import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";

/**
 * H4: entitlement JWT signed with fixture Ed25519 private key must verify
 * against the public key shipped with envsync-api (same keypair as unit tests).
 */
const fixtureDir = path.resolve(import.meta.dir, "../../envsync-api/tests/fixtures/license");
const privatePem = fs.readFileSync(path.join(fixtureDir, "entitlement-private.pem"), "utf8");
const publicPem = fs.readFileSync(path.join(fixtureDir, "entitlement-public.pem"), "utf8");
const apiBundledPublic = fs.readFileSync(
	path.resolve(import.meta.dir, "../../envsync-api/src/assets/license/envsync-entitlement-public.pem"),
	"utf8",
);

describe("H4 entitlement JWT (license-server → api verify key)", () => {
	test("fixture private key matches API bundled public key", () => {
		expect(publicPem.trim()).toBe(apiBundledPublic.trim());
	});

	test("EdDSA JWT with entitlement claims verifies as license-server issuer", async () => {
		const privateKey = await importPKCS8(privatePem, "EdDSA");
		const publicKey = await importSPKI(publicPem, "EdDSA");
		const now = Math.floor(Date.now() / 1000);
		const jwt = await new SignJWT({
			ver: 1,
			install_fingerprint: "fp-h4-test",
			edition: "enterprise",
			features: ["management", "oidc", "integrations"],
			max_orgs: 3,
		})
			.setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
			.setIssuer("envsync-license-server")
			.setSubject("fp-h4-test")
			.setIssuedAt(now)
			.setExpirationTime(now + 600)
			.sign(privateKey);

		const { payload } = await jwtVerify(jwt, publicKey, {
			algorithms: ["EdDSA"],
			issuer: "envsync-license-server",
		});
		expect(payload.install_fingerprint).toBe("fp-h4-test");
		expect(payload.max_orgs).toBe(3);
		expect(payload.features).toContain("oidc");
	});
});
