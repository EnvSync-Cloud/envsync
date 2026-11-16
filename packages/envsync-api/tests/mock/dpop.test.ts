import {
	generateKeyPair,
	exportJWK,
	SignJWT,
	calculateJwkThumbprint,
	type JWK,
	type JWTHeaderParameters,
} from "jose";
import { describe, expect, test } from "bun:test";

import {
	confirmationThumbprint,
	requestProofUrls,
	sessionClientRequiresDpop,
	verifyDpopProof,
} from "@/helpers/dpop";
import { config } from "@/utils/env";

async function proof(input: {
	key: CryptoKey;
	jwk: JWK;
	method: string;
	url: string;
	accessToken?: string;
	jti?: string;
}) {
	const claims: Record<string, unknown> = {
		htm: input.method,
		htu: input.url,
		jti: input.jti ?? crypto.randomUUID(),
	};
	if (input.accessToken) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(input.accessToken),
		);
		claims.ath = Buffer.from(digest).toString("base64url");
	}
	return new SignJWT(claims)
		.setProtectedHeader({
			alg: "ES256",
			typ: "dpop+jwt",
			jwk: input.jwk as JWTHeaderParameters["jwk"],
		})
		.setIssuedAt()
		.sign(input.key);
}

describe("DPoP proofs", () => {
	test("accepts a proof for the same key, method, url, and token", async () => {
		const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
		const jwk = await exportJWK(publicKey);
		const jkt = await calculateJwkThumbprint(jwk, "sha256");
		const token = "access-token";
		const signed = await proof({
			key: privateKey,
			jwk,
			method: "GET",
			url: "https://api.envsync.cloud/api/access/me",
			accessToken: token,
		});

		await verifyDpopProof({
			proof: signed,
			method: "GET",
			url: "https://api.envsync.cloud/api/access/me?x=1",
			accessToken: token,
			expectedJkt: jkt,
		});
		expect(confirmationThumbprint({ cnf: { jkt } })).toBe(jkt);
	});

	test("rejects a proof signed by another key", async () => {
		const first = await generateKeyPair("ES256", { extractable: true });
		const second = await generateKeyPair("ES256", { extractable: true });
		const jwk = await exportJWK(second.publicKey);
		const expected = await calculateJwkThumbprint(await exportJWK(first.publicKey), "sha256");
		const signed = await proof({
			key: second.privateKey,
			jwk,
			method: "GET",
			url: "https://api.envsync.cloud/api/access/me",
			accessToken: "access-token",
		});

		await expect(
			verifyDpopProof({
				proof: signed,
				method: "GET",
				url: "https://api.envsync.cloud/api/access/me",
				accessToken: "access-token",
				expectedJkt: expected,
			}),
		).rejects.toMatchObject({ code: "DPOP_KEY_MISMATCH" });
	});

	test("accepts a token-endpoint proof without ath and an alternate public url", async () => {
		const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
		const jwk = await exportJWK(publicKey);
		const jkt = await calculateJwkThumbprint(jwk, "sha256");
		const tokenEndpoint = await proof({
			key: privateKey,
			jwk,
			method: "POST",
			url: "https://auth.envsync.cloud/oauth/token",
		});
		const thumbprint = await verifyDpopProof({
			proof: tokenEndpoint,
			method: "POST",
			url: "https://auth.envsync.cloud/oauth/token",
			accessToken: "",
		});
		expect(thumbprint).toBe(jkt);

		const resource = await proof({
			key: privateKey,
			jwk,
			method: "GET",
			url: "https://api.envsync.cloud/api/auth/me",
			accessToken: "access-token",
		});
		await verifyDpopProof({
			proof: resource,
			method: "GET",
			url: "http://127.0.0.1:4000/api/auth/me",
			urls: requestProofUrls("http://127.0.0.1:4000/api/auth/me").concat(
				"https://api.envsync.cloud/api/auth/me",
			),
			accessToken: "access-token",
			expectedJkt: jkt,
		});
	});

	test("requires a device key for web and cli clients only", () => {
		expect(sessionClientRequiresDpop(config.ATRIUM_WEB_CLIENT_ID)).toBe(true);
		expect(sessionClientRequiresDpop(config.ATRIUM_CLI_CLIENT_ID)).toBe(true);
		expect(sessionClientRequiresDpop(config.ATRIUM_E2E_CLIENT_ID)).toBe(false);
		expect(sessionClientRequiresDpop("envsync-api")).toBe(false);
	});
});
