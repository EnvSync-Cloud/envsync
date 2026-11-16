import {
	calculateJwkThumbprint,
	decodeJwt,
	decodeProtectedHeader,
	importJWK,
	jwtVerify,
} from "jose";

import { AppError } from "@/libs/errors";
import { config } from "@/utils/env";

const proofMaxAgeSeconds = 300;
const seenProofs = new Map<string, number>();

export function sessionClientRequiresDpop(clientId: unknown): boolean {
	return clientId === config.ATRIUM_CLI_CLIENT_ID || clientId === config.ATRIUM_WEB_CLIENT_ID;
}

export function requestProofUrls(requestUrl: string): string[] {
	const urls = [requestUrl];
	if (!config.API_URL) return urls;
	try {
		const path = new URL(requestUrl).pathname;
		const base = config.API_URL.endsWith("/") ? config.API_URL : `${config.API_URL}/`;
		urls.push(new URL(path, base).toString());
	} catch {
		return urls;
	}
	return [...new Set(urls)];
}

export function deviceLabel(value: unknown, fallback: string) {
	if (typeof value !== "string") return fallback;
	const cleaned = value
		.replace(/[\u0000-\u001f\u007f]/g, "")
		.trim()
		.slice(0, 80);
	return cleaned || fallback;
}

export function defaultDeviceLabel(clientId: string, userAgent: string | undefined) {
	if (clientId === config.ATRIUM_CLI_CLIENT_ID) return "CLI";
	const ua = userAgent ?? "";
	const browser = /Edg\//.test(ua)
		? "Edge"
		: /Chrome\//.test(ua)
			? "Chrome"
			: /Firefox\//.test(ua)
				? "Firefox"
				: /Safari\//.test(ua)
					? "Safari"
					: "Browser";
	const os = /Mac/.test(ua)
		? "macOS"
		: /Windows/.test(ua)
			? "Windows"
			: /Android/.test(ua)
				? "Android"
				: /iPhone|iPad/.test(ua)
					? "iOS"
					: /Linux/.test(ua)
						? "Linux"
						: "";
	return os && browser !== "Browser" ? `${browser} on ${os}` : browser;
}

export function confirmationThumbprint(
	payload: Record<string, unknown> | null | undefined,
): string {
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
	urls?: string[];
	accessToken?: string;
	expectedJkt?: string;
}): Promise<string> {
	if (!input.proof) {
		throw new AppError("DPoP proof is required", 401, "DPOP_REQUIRED");
	}

	const header = decodeProtectedHeader(input.proof);
	if (
		header.typ !== "dpop+jwt" ||
		header.alg !== "ES256" ||
		!header.jwk ||
		typeof header.jwk !== "object"
	) {
		throw new AppError("DPoP proof header is invalid", 401, "DPOP_INVALID");
	}

	const jwk = header.jwk as Record<string, unknown>;
	if (jwk.d !== undefined || jwk.kty !== "EC" || jwk.crv !== "P-256") {
		throw new AppError("DPoP proof key is invalid", 401, "DPOP_INVALID");
	}

	const thumbprint = await calculateJwkThumbprint(jwk, "sha256");
	if (input.expectedJkt && thumbprint !== input.expectedJkt) {
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
	const accepted = (input.urls && input.urls.length > 0 ? input.urls : [input.url]).flatMap(
		value => {
			try {
				return [htu(value)];
			} catch {
				return [];
			}
		},
	);
	let actual = "";
	try {
		actual = htu(String(claims.htu ?? ""));
	} catch {
		actual = "";
	}
	if (claims.htm !== input.method.toUpperCase() || !actual || !accepted.includes(actual)) {
		throw new AppError("DPoP proof does not match this request", 401, "DPOP_URL_MISMATCH");
	}

	if (input.accessToken) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(input.accessToken),
		);
		const ath = Buffer.from(digest).toString("base64url");
		if (claims.ath !== ath) {
			throw new AppError("DPoP proof does not match the access token", 401, "DPOP_TOKEN_MISMATCH");
		}
	}

	rememberProof(String(claims.jti), iat + proofMaxAgeSeconds);
	return thumbprint;
}

export function readUnverifiedClientId(token: string): string {
	try {
		const payload = decodeJwt(token.replace(/^(?:Bearer|DPoP)\s+/i, ""));
		const clientId = payload.client_id ?? payload.azp;
		return typeof clientId === "string" ? clientId : "";
	} catch {
		return "";
	}
}
