import { createPublicKey, type KeyObject } from "node:crypto";
import fs from "node:fs";

import { decodeProtectedHeader, importSPKI, jwtVerify, type JWTPayload } from "jose";

import { ForbiddenError } from "@/libs/errors";
import { config } from "@/utils/env";
import {
	ENTITLEMENT_FIXTURE_KID,
	ENTITLEMENT_RETIRED_KID,
	isRetiredEntitlementPublicKey,
	loadConfiguredTrustedKeys,
} from "@/services/entitlement-keys";
import {
	ALL_ENTERPRISE_FEATURES,
	DEFAULT_ENTERPRISE_FEATURE_SET,
	isEnterpriseFeature,
	type EnterpriseFeature,
	type EntitlementClaims,
	type VerifiedEntitlement,
} from "@/services/entitlement.types";
import { EditionPolicyService } from "@/services/edition-policy.service";

const ENTITLEMENT_ISS = "envsync-license-server";
const DEFAULT_GRACE_SECONDS = 72 * 60 * 60; // 72h grace after exp (Coder-like)

type EntitlementTestOverrides = {
	claims?: EntitlementClaims | null;
	public_key_pem?: string;
	public_key_kid?: string;
	trusted_keys?: Record<string, string>;
	/** When true, the fixture verification key may be used. Production verification leaves this unset. */
	allow_fixture_keys?: boolean;
	jwt?: string | null;
	disable?: boolean;
};

function readIfExists(filePath?: string) {
	if (!filePath) return null;
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function normalizeFeatures(raw: unknown): EnterpriseFeature[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		return [...DEFAULT_ENTERPRISE_FEATURE_SET];
	}
	const features = raw.filter((f): f is string => typeof f === "string").filter(isEnterpriseFeature);
	return features.length > 0 ? features : [...DEFAULT_ENTERPRISE_FEATURE_SET];
}

function payloadToClaims(payload: JWTPayload): EntitlementClaims {
	const install =
		typeof payload.install_fingerprint === "string"
			? payload.install_fingerprint
			: typeof payload.sub === "string"
				? payload.sub
				: "";
	const maxOrgs =
		typeof payload.max_orgs === "number"
			? payload.max_orgs
			: typeof payload.max_orgs === "string"
				? Number.parseInt(payload.max_orgs, 10)
				: undefined;

	return {
		ver: typeof payload.ver === "number" ? payload.ver : 1,
		install_fingerprint: install,
		edition: "enterprise",
		features: normalizeFeatures(payload.features),
		max_orgs: Number.isFinite(maxOrgs) && (maxOrgs as number) >= 1 ? (maxOrgs as number) : undefined,
		seats: typeof payload.seats === "number" ? payload.seats : undefined,
		iss: typeof payload.iss === "string" ? payload.iss : undefined,
		exp: typeof payload.exp === "number" ? payload.exp : undefined,
		nbf: typeof payload.nbf === "number" ? payload.nbf : undefined,
		iat: typeof payload.iat === "number" ? payload.iat : undefined,
	};
}

/**
 * Coder-style entitlement verification.
 * Authority is crypto (Ed25519 JWT), not DB status rows alone.
 * The JWT `kid` selects the public key from the configured trust set.
 */
export class EntitlementService {
	static #testOverrides: EntitlementTestOverrides | null = null;
	static #cached: VerifiedEntitlement | null = null;

	public static setTestOverrides(overrides: EntitlementTestOverrides) {
		this.#testOverrides = { ...overrides };
		this.#cached = null;
	}

	public static clearTestOverrides() {
		this.#testOverrides = null;
		this.#cached = null;
	}

	public static clearCache() {
		this.#cached = null;
	}

	public static getGraceSeconds() {
		const raw = config.ENVSYNC_ENTITLEMENT_GRACE_SECONDS;
		const n = raw ? Number.parseInt(raw, 10) : DEFAULT_GRACE_SECONDS;
		return Number.isFinite(n) && n >= 0 ? n : DEFAULT_GRACE_SECONDS;
	}

	/** Fixture key trust is opt-in and is ignored when NODE_ENV is production. */
	private static fixtureKeysAllowed() {
		return this.#testOverrides?.allow_fixture_keys === true && config.NODE_ENV !== "production";
	}

	/**
	 * Production trust set, with the bundled key and the test fixture key removed.
	 * Explicit test mode may add the fixture key back.
	 */
	private static resolveTrustedKeys() {
		const allowFixture = this.fixtureKeysAllowed();
		const keys = loadConfiguredTrustedKeys();

		if (!allowFixture) {
			for (const kid of [...keys.keys()]) {
				const pem = keys.get(kid);
				if (!pem) continue;
				if (
					kid === ENTITLEMENT_FIXTURE_KID
					|| kid === ENTITLEMENT_RETIRED_KID
					|| isRetiredEntitlementPublicKey(pem)
				) {
					keys.delete(kid);
				}
			}
		}

		if (allowFixture && this.#testOverrides?.public_key_pem?.trim()) {
			const pem = this.#testOverrides.public_key_pem.trim();
			keys.set(this.#testOverrides.public_key_kid?.trim() || ENTITLEMENT_FIXTURE_KID, pem);
			if (isRetiredEntitlementPublicKey(pem)) {
				keys.set(ENTITLEMENT_RETIRED_KID, pem);
				keys.set(ENTITLEMENT_FIXTURE_KID, pem);
			}
		}

		for (const [kid, pem] of Object.entries(this.#testOverrides?.trusted_keys ?? {})) {
			if (!pem?.trim()) continue;
			const retiredKid = kid === ENTITLEMENT_FIXTURE_KID || kid === ENTITLEMENT_RETIRED_KID;
			if (!allowFixture && (retiredKid || isRetiredEntitlementPublicKey(pem))) {
				continue;
			}
			keys.set(kid, pem.trim());
		}

		return keys;
	}

	private static loadJwtFromEnv(): string | null {
		if (this.#testOverrides?.jwt !== undefined) {
			return this.#testOverrides.jwt;
		}
		const inline = config.ENVSYNC_ENTITLEMENT_JWT?.trim();
		if (inline) return inline;
		return readIfExists(config.ENVSYNC_ENTITLEMENT_JWT_PATH)?.trim() || null;
	}

	/**
	 * Verify a raw entitlement JWT.
	 * The protected header `kid` selects the public key.
	 * The result is cached unless `apply` is false.
	 */
	public static async verifyJwt(rawJwt: string, options?: { apply?: boolean; allowGrace?: boolean }) {
		const allowGrace = options?.allowGrace !== false;
		const grace = this.getGraceSeconds();

		let payload: JWTPayload;
		let kid = "";
		try {
			const header = decodeProtectedHeader(rawJwt);
			kid = typeof header.kid === "string" ? header.kid.trim() : "";
			if (!kid) {
				throw new ForbiddenError(
					"Entitlement JWT is missing a key id.",
					"ENTITLEMENT_INVALID",
				);
			}
			const pem = this.resolveTrustedKeys().get(kid);
			if (!pem || (!this.fixtureKeysAllowed() && isRetiredEntitlementPublicKey(pem))) {
				throw new ForbiddenError(
					"Entitlement key id is not trusted.",
					"ENTITLEMENT_INVALID",
				);
			}
			const key = await importSPKI(pem, "EdDSA");
			const result = await jwtVerify(rawJwt, key, {
				algorithms: ["EdDSA"],
				issuer: ENTITLEMENT_ISS,
				clockTolerance: allowGrace ? grace : 0,
			});
			payload = result.payload;
		} catch (error) {
			if (error instanceof ForbiddenError) throw error;
			const message = error instanceof Error ? error.message : String(error);
			throw new ForbiddenError(
				`Invalid enterprise entitlement: ${message}`,
				"ENTITLEMENT_INVALID",
			);
		}

		const claims = payloadToClaims(payload);
		const fingerprint = config.ENVSYNC_INSTALL_FINGERPRINT ?? "";
		if (fingerprint && claims.install_fingerprint && claims.install_fingerprint !== fingerprint) {
			throw new ForbiddenError(
				"Entitlement install fingerprint does not match this deployment.",
				"ENTITLEMENT_FINGERPRINT_MISMATCH",
			);
		}

		const expMs = claims.exp ? claims.exp * 1000 : null;
		const now = Date.now();
		const inGrace = Boolean(expMs && expMs <= now && expMs + grace * 1000 > now);
		if (expMs && expMs + (allowGrace ? grace * 1000 : 0) <= now) {
			throw new ForbiddenError("Enterprise entitlement has expired.", "ENTITLEMENT_EXPIRED");
		}

		const verified: VerifiedEntitlement = {
			claims,
			kid,
			source: "jwt",
			verified_at: new Date(),
			in_grace: inGrace,
			expires_at: expMs ? new Date(expMs) : null,
		};

		if (options?.apply !== false) {
			this.#cached = verified;
		}
		return verified;
	}

	/** Apply claims from a validated certificate (offline path). */
	public static applyCertificateClaims(input: {
		install_fingerprint: string;
		features?: EnterpriseFeature[];
		max_orgs?: number;
		expires_at: Date | null;
	}) {
		const verified: VerifiedEntitlement = {
			claims: {
				ver: 1,
				install_fingerprint: input.install_fingerprint,
				edition: "enterprise",
				features: input.features?.length ? input.features : [...DEFAULT_ENTERPRISE_FEATURE_SET],
				max_orgs: input.max_orgs,
			},
			source: "certificate",
			verified_at: new Date(),
			in_grace: false,
			expires_at: input.expires_at,
		};
		this.#cached = verified;
		return verified;
	}

	/**
	 * Resolve current entitlement (cache → env JWT → null).
	 * Does not invent entitlements for unenforced local enterprise.
	 */
	public static async resolve(): Promise<VerifiedEntitlement | null> {
		if (this.#testOverrides?.disable) {
			return null;
		}
		if (this.#testOverrides?.claims) {
			const verified: VerifiedEntitlement = {
				claims: this.#testOverrides.claims,
				source: "test",
				verified_at: new Date(),
				in_grace: false,
				expires_at: this.#testOverrides.claims.exp
					? new Date(this.#testOverrides.claims.exp * 1000)
					: null,
			};
			this.#cached = verified;
			return verified;
		}
		if (this.#cached) {
			return this.#cached;
		}
		const jwt = this.loadJwtFromEnv();
		if (jwt) {
			return this.verifyJwt(jwt);
		}
		return null;
	}

	public static getCached(): VerifiedEntitlement | null {
		return this.#cached;
	}

	public static hasFeature(feature: EnterpriseFeature, entitlement?: VerifiedEntitlement | null) {
		const ent = entitlement ?? this.#cached;
		if (!ent) return false;
		return ent.claims.features.includes(feature);
	}

	public static getMaxOrgsFromEntitlement(entitlement?: VerifiedEntitlement | null): number | null {
		const ent = entitlement ?? this.#cached;
		if (!ent) return null;
		if (ent.claims.features.includes("multi_org")) {
			return ent.claims.max_orgs ?? null;
		}
		return ent.claims.max_orgs ?? 1;
	}

	public static async getInstallFeatures(): Promise<EnterpriseFeature[]> {
		if (EditionPolicyService.isOss()) {
			return [];
		}
		if (EditionPolicyService.isHosted()) {
			return [...ALL_ENTERPRISE_FEATURES];
		}
		if (!EditionPolicyService.requiresEnterpriseLicense()) {
			return EditionPolicyService.isEnterprise() ? [...ALL_ENTERPRISE_FEATURES] : [];
		}
		const entitlement = await this.resolve();
		if (!entitlement) {
			return [];
		}
		return [...entitlement.claims.features];
	}

	public static async getOrgFeatures(orgId: string): Promise<EnterpriseFeature[]> {
		const ceiling = await this.getInstallFeatures();
		if (!orgId) {
			return ceiling;
		}
		if (!EditionPolicyService.isHosted()) {
			return ceiling;
		}
		const { PlanService } = await import("@/services/plan.service");
		const resolved = await PlanService.resolve(orgId);
		const granted = new Set(resolved.features);
		return ceiling.filter(feature => feature === "multi_org" || granted.has(feature));
	}

	public static async assertFeature(feature: EnterpriseFeature) {
		if (EditionPolicyService.isOss()) {
			throw new ForbiddenError(
				"This feature requires an enterprise license.",
				"ENTERPRISE_FEATURE_REQUIRED",
			);
		}

		const ceiling = await this.getInstallFeatures();
		if (ceiling.includes(feature)) {
			return;
		}

		if (EditionPolicyService.isHosted()) {
			throw new ForbiddenError(
				`This feature is not included in the current entitlement (${feature}).`,
				"ENTITLEMENT_FEATURE_MISSING",
			);
		}

		if (!EditionPolicyService.requiresEnterpriseLicense()) {
			throw new ForbiddenError(
				"This feature requires an enterprise license.",
				"ENTERPRISE_FEATURE_REQUIRED",
			);
		}

		const entitlement = await this.resolve();
		if (!entitlement) {
			throw new ForbiddenError(
				"A valid enterprise entitlement is required for this feature.",
				"ENTITLEMENT_REQUIRED",
			);
		}
		throw new ForbiddenError(
			`This feature is not included in the current entitlement (${feature}).`,
			"ENTITLEMENT_FEATURE_MISSING",
		);
	}

	public static async assertOrgFeature(orgId: string, feature: EnterpriseFeature) {
		await this.assertFeature(feature);

		if (!EditionPolicyService.isHosted()) {
			return;
		}
		if (feature === "multi_org") {
			return;
		}

		const { PlanService } = await import("@/services/plan.service");
		const resolved = await PlanService.resolve(orgId);
		if (!resolved.features.includes(feature)) {
			throw new ForbiddenError(
				`This organization is not entitled for this feature (${feature}).`,
				"ORG_FEATURE_MISSING",
			);
		}
	}

	/** Node KeyObject for tests/tools that need crypto.verify style APIs. */
	public static loadPublicKeyObject(kid?: string): KeyObject {
		const keys = this.resolveTrustedKeys();
		const pem = (kid ? keys.get(kid) : [...keys.values()][0]) ?? null;
		if (!pem || (!this.fixtureKeysAllowed() && isRetiredEntitlementPublicKey(pem))) {
			throw new ForbiddenError("Entitlement key id is not trusted.", "ENTITLEMENT_INVALID");
		}
		return createPublicKey(pem);
	}
}
