import { createHmac, timingSafeEqual } from "node:crypto";
import { calculateJwkThumbprint, flattenedVerify, importJWK, type JWK, type FlattenedJWSInput } from "jose";

const nonces = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000;

export function issueAcmeNonce() {
	const nonce = crypto.randomUUID();
	nonces.set(nonce, Date.now() + NONCE_TTL_MS);
	return nonce;
}

export function consumeAcmeNonce(nonce: string | undefined) {
	if (!nonce) {
		return false;
	}
	const expires = nonces.get(nonce);
	nonces.delete(nonce);
	return Boolean(expires && expires > Date.now());
}

export type AcmeJws = {
	protected: string;
	payload: string;
	signature: string;
};

function b64urlJson(value: string) {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const buf = Buffer.from(padded, "base64");
	return JSON.parse(buf.toString("utf8")) as Record<string, unknown>;
}

export async function verifyAcmeJws(body: AcmeJws, accountJwk?: JWK) {
	const header = b64urlJson(body.protected);
	const nonce = typeof header.nonce === "string" ? header.nonce : undefined;
	if (!consumeAcmeNonce(nonce)) {
		throw new Error("invalid ACME nonce");
	}
	const jwk = (header.jwk as JWK | undefined) ?? accountJwk;
	if (!jwk) {
		throw new Error("ACME JWS is missing a JWK");
	}
	const key = await importJWK(jwk, typeof header.alg === "string" ? header.alg : "ES256");
	const verified = await flattenedVerify(body as FlattenedJWSInput, key);
	const payload = JSON.parse(new TextDecoder().decode(verified.payload)) as Record<string, unknown>;
	const thumbprint = await calculateJwkThumbprint(jwk);
	return { header, payload, jwk, thumbprint };
}

export function verifyEab(binding: AcmeJws, hmacKey: string, expectedKid: string) {
	const header = b64urlJson(binding.protected);
	if (header.kid !== expectedKid) {
		throw new Error("EAB kid mismatch");
	}
	const mac = createHmac("sha256", Buffer.from(hmacKey, "base64url"))
		.update(`${binding.protected}.${binding.payload}`)
		.digest();
	const given = Buffer.from(binding.signature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
	if (mac.length !== given.length || !timingSafeEqual(mac, given)) {
		throw new Error("EAB HMAC mismatch");
	}
}
