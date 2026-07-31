/**
 * Enterprise feature catalog for Coder-style entitlement claims (Phase 4).
 * Keep in sync with license-server claim issuers and EE route guards.
 */
export const ENTERPRISE_FEATURES = [
	"management",
	"oidc",
	"saml",
	"rotation",
	"dynamic_secrets",
	"log_forwarding",
	"integrations",
	"multi_org",
] as const;

export type EnterpriseFeature = (typeof ENTERPRISE_FEATURES)[number];

export const ALL_ENTERPRISE_FEATURES: EnterpriseFeature[] = [...ENTERPRISE_FEATURES];

/** Default features when a valid enterprise license has no explicit features[] claim. */
export const DEFAULT_ENTERPRISE_FEATURE_SET: EnterpriseFeature[] = [
	"management",
	"oidc",
	"saml",
	"rotation",
	"dynamic_secrets",
	"log_forwarding",
	"integrations",
];

export type EntitlementClaims = {
	/** Claim schema version */
	ver: number;
	/** Install fingerprint this entitlement is bound to */
	install_fingerprint: string;
	edition: "enterprise";
	/** Feature flags granted by this license */
	features: EnterpriseFeature[];
	/** Max orgs on self-host; omit or 1 for single-tenant default */
	max_orgs?: number;
	/** Optional seat count */
	seats?: number;
	/** Issuer label */
	iss?: string;
	/** Standard JWT exp (seconds) */
	exp?: number;
	/** Not before */
	nbf?: number;
	/** Issued at */
	iat?: number;
};

export type VerifiedEntitlement = {
	claims: EntitlementClaims;
	/** Raw JWT or "certificate" / "dev" source */
	source: "jwt" | "certificate" | "test";
	/** Wall-clock when crypto verification last succeeded */
	verified_at: Date;
	/** True if past exp but within grace window */
	in_grace: boolean;
	expires_at: Date | null;
};
