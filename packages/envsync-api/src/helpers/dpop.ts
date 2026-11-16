import { calculateJwkThumbprint, decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from "jose";

import { AppError } from "@/libs/errors";
import { config } from "@/utils/env";

const proofMaxAgeSeconds = 300;
const seenProofs = new Map<string, number>();

export function sessionClientRequiresDpop(clientId: unknown): boolean {
	// The dashboard still exchanges the login code on the server, so it cannot
	// sign a proof yet. Only the CLI client is required on this release.
	return clientId === config.ATRIUM_CLI_CLIENT_ID;
}

export function confirmationThumbprint(payload: Record<string, unknown> | null | undefined): string {
	const cnf = payload?.cnf;
	if (!cnf || typeof cnf !== "object") return "";
	const jkt = (cnf as { jkt?: unknown }).jkt;
	return typeof jkt === "string" ? jkt : "";
}

function htu(url: string): string {
	const parsed = new URL(url);
	parsed.search = "";
	parsed.hash = "";
	return parsed.toString();
}

function rememberProof(jti: string, exp: number) {
	const now = Math.floor(Date.now() / 1000);
	for (const [id, expires] of seenProofs) {
		if (expires <= now) seenProofs.delete(id);
	}
	if (seenProofs.has(jti)) {
		throw new AppError("DPoP proof was already used", 401, "DPOP_REPLAYED");
	}
	seenProofs.set(jti, exp);
}

export async function verifyDpopProof(input: {
	proof: string;
	method: string;
	url: string;
	accessToken: string;
	expectedJkt: string;
}): Promise<void> {
	if (!input.proof) {
		throw new AppError("DPoP proof is required", 401, "DPOP_REQUIRED");
	}

	const header = decodeProtectedHeader(input.proof);
	if (header.typ !== "dpop+jwt" || header.alg !== "ES256" || !header.jwk || typeof header.jwk !== "object") {
		throw new AppError("DPoP proof header is invalid", 401, "DPOP_INVALID");
	}

	const jwk = header.jwk as Record<string, unknown>;
	if (jwk.d !== undefined || jwk.kty !== "EC" || jwk.crv !== "P-256") {
		throw new AppError("DPoP proof key is invalid", 401, "DPOP_INVALID");
	}

	const thumbprint = await calculateJwkThumbprint(jwk, "sha256");
	if (thumbprint !== input.expectedJkt) {
		throw new AppError("DPoP key does not match the token", 401, "DPOP_KEY_MISMATCH");
	}

	const key = await importJWK(jwk, "ES256");
	const verified = await jwtVerify(input.proof, key, { algorithms: ["ES256"] });
	const claims = verified.payload;
	const now = Math.floor(Date.now() / 1000);
	const iat = typeof claims.iat === "number" ? claims.iat : 0;
	if (!claims.jti || iat <= 0 || Math.abs(now - iat) > proofMaxAgeSeconds) {
		throw new AppError("DPoP proof is expired", 401, "DPOP_EXPIRED");
	}
	if (claims.htm !== input.method.toUpperCase() || claims.htu !== htu(input.url)) {
		throw new AppError("DPoP proof does not match this request", 401, "DPOP_URL_MISMATCH");
	}

	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.accessToken));
	const ath = Buffer.from(digest).toString("base64url");
	if (claims.ath !== ath) {
		throw new AppError("DPoP proof does not match the access token", 401, "DPOP_TOKEN_MISMATCH");
	}

	rememberProof(String(claims.jti), iat + proofMaxAgeSeconds);
}

export function readUnverifiedClientId(token: string): string {
	try {
		const payload = decodeJwt(token);
		const clientId = payload.client_id ?? payload.azp;
		return typeof clientId === "string" ? clientId : "";
	} catch {
		return "";
	}
}
