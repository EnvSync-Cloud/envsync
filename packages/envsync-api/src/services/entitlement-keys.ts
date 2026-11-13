import fs from "node:fs";
import path from "node:path";

import { ForbiddenError } from "@/libs/errors";
import { config } from "@/utils/env";

/** Key id for the public key previously bundled with the API. Not trusted in production. */
export const ENTITLEMENT_RETIRED_KID = "envsync-entitlement-v1";

/** Key id for the test fixture verification key. Accepted only in explicit test mode. */
export const ENTITLEMENT_FIXTURE_KID = "envsync-entitlement-fixture";

/** Key id reserved for the next offline-generated verification key. */
export const ENTITLEMENT_NEXT_KID = "envsync-entitlement-next";

const RETIRED_PUBLIC_KEY_PATH = path.join(
	import.meta.dir,
	"../assets/license/envsync-entitlement-public.pem",
);
const TRUSTED_PUBLIC_KEYS_PATH = path.join(
	import.meta.dir,
	"../assets/license/trusted-public-keys.json",
);

let retiredMaterial: string | null | undefined;

export function normalizePublicKeyPem(pem: string) {
	return pem
		.replace(/-----BEGIN PUBLIC KEY-----/g, "")
		.replace(/-----END PUBLIC KEY-----/g, "")
		.replace(/\s+/g, "");
}

function readIfExists(filePath?: string) {
	if (!filePath) return null;
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

/**
 * SPKI body of the verification key that shipped with the API.
 * Production verification compares against this material and refuses it.
 */
export function retiredEntitlementPublicKeyMaterial(): string | null {
	if (retiredMaterial !== undefined) return retiredMaterial;
	try {
		retiredMaterial = normalizePublicKeyPem(fs.readFileSync(RETIRED_PUBLIC_KEY_PATH, "utf8"));
	} catch {
		retiredMaterial = null;
	}
	return retiredMaterial;
}

export function isRetiredEntitlementPublicKey(pem: string) {
	const retired = retiredEntitlementPublicKeyMaterial();
	if (!retired) return false;
	return normalizePublicKeyPem(pem) === retired;
}

function addKey(keys: Map<string, string>, kid: string | undefined, pem: string | null | undefined) {
	const id = kid?.trim();
	const body = pem?.trim();
	if (!id || !body || !body.includes("BEGIN PUBLIC KEY")) return;
	keys.set(id, body);
}

function readPlaceholderKeys() {
	try {
		const parsed = JSON.parse(fs.readFileSync(TRUSTED_PUBLIC_KEYS_PATH, "utf8")) as Record<string, unknown>;
		const keys = new Map<string, string>();
		for (const [kid, value] of Object.entries(parsed)) {
			if (kid.startsWith("_")) continue;
			if (typeof value === "string") addKey(keys, kid, value);
		}
		return keys;
	} catch {
		return new Map<string, string>();
	}
}

/**
 * Trusted verification keys for production.
 * `kid` selects an entry. The bundled key and the test fixture key are not included.
 * `ENVSYNC_LICENSE_TRUSTED_KEYS` and `ENVSYNC_LICENSE_PUBLIC_KEY_KID` override the placeholder file.
 */
export function loadConfiguredTrustedKeys() {
	const keys = readPlaceholderKeys();
	const raw = config.ENVSYNC_LICENSE_TRUSTED_KEYS?.trim();
	if (raw) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			throw new ForbiddenError(
				"Entitlement trusted keys configuration is invalid.",
				"ENTITLEMENT_INVALID",
			);
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new ForbiddenError(
				"Entitlement trusted keys configuration is invalid.",
				"ENTITLEMENT_INVALID",
			);
		}
		for (const [kid, pem] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof pem === "string") addKey(keys, kid, pem);
		}
	}

	const singlePem = config.ENVSYNC_LICENSE_PUBLIC_KEY_PEM?.trim()
		|| readIfExists(config.ENVSYNC_LICENSE_PUBLIC_KEY_PATH);
	addKey(keys, config.ENVSYNC_LICENSE_PUBLIC_KEY_KID, singlePem);
	return keys;
}
