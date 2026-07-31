import { ConflictError } from "@/libs/errors";
import { config } from "@/utils/env";

export type EnvSyncEdition = "oss" | "enterprise";

type EditionPolicyTestOverrides = {
	edition?: EnvSyncEdition;
	management_enabled?: boolean;
	landing_enabled?: boolean;
	management_web_enabled?: boolean;
	observability_enabled?: boolean;
	single_org_mode?: boolean;
	license_enforcement?: boolean;
};

function parseBoolean(value: string | undefined, fallback = false) {
	if (value === undefined) {
		return fallback;
	}

	return value === "true";
}

/**
 * Edition / install policy.
 *
 * Program note (feat/the-big-update): Phase 1 will add deployment_mode + org-create
 * channel enforcement. Reserved env vars ENVSYNC_DEPLOYMENT_MODE and ENVSYNC_MAX_ORGS
 * are parsed in env.ts but not applied here until Phase 1.
 *
 * @see docs/plans/2026-08-no-piggyback-program.md
 * @see docs/plans/phase-0/org-create-inventory.md
 */
export class EditionPolicyService {
	static #testOverrides: EditionPolicyTestOverrides | null = null;

	public static setTestOverrides(overrides: EditionPolicyTestOverrides) {
		this.#testOverrides = { ...overrides };
	}

	public static clearTestOverrides() {
		this.#testOverrides = null;
	}

	public static getEdition(): EnvSyncEdition {
		return this.#testOverrides?.edition ?? config.ENVSYNC_EDITION;
	}

	public static isEnterprise() {
		return this.getEdition() === "enterprise";
	}

	public static isOss() {
		return this.getEdition() === "oss";
	}

	public static isManagementEnabled() {
		if (this.#testOverrides?.management_enabled !== undefined) {
			return this.#testOverrides.management_enabled;
		}
		return parseBoolean(config.ENVSYNC_MANAGEMENT_ENABLED, this.isEnterprise());
	}

	public static isLandingEnabled() {
		if (this.#testOverrides?.landing_enabled !== undefined) {
			return this.#testOverrides.landing_enabled;
		}
		return parseBoolean(config.ENVSYNC_LANDING_ENABLED, this.isEnterprise());
	}

	public static isManagementWebEnabled() {
		if (this.#testOverrides?.management_web_enabled !== undefined) {
			return this.#testOverrides.management_web_enabled;
		}
		return parseBoolean(config.ENVSYNC_MANAGEMENT_WEB_ENABLED, this.isEnterprise());
	}

	public static isObservabilityEnabled() {
		if (this.#testOverrides?.observability_enabled !== undefined) {
			return this.#testOverrides.observability_enabled;
		}
		return parseBoolean(config.ENVSYNC_OBSERVABILITY_ENABLED, true);
	}

	public static isSingleOrgMode() {
		if (this.#testOverrides?.single_org_mode !== undefined) {
			return this.#testOverrides.single_org_mode;
		}
		return this.isOss() || parseBoolean(config.ENVSYNC_SINGLE_ORG_MODE, false);
	}

	public static requiresEnterpriseLicense() {
		const enforced = this.#testOverrides?.license_enforcement
			?? parseBoolean(config.ENVSYNC_LICENSE_ENFORCEMENT, false);
		return this.isEnterprise() && enforced;
	}

	public static assertOrgProvisioningAllowed(orgCount: number) {
		if (this.isSingleOrgMode() && orgCount >= 1) {
			throw new ConflictError(
				"This deployment is limited to a single organization.",
				"OSS_SINGLE_ORG_LIMIT_REACHED",
			);
		}
	}
}
