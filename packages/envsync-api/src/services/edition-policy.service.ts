import { ConflictError, ForbiddenError } from "@/libs/errors";
import { config } from "@/utils/env";

export type EnvSyncEdition = "oss" | "enterprise";
export type EnvSyncDeploymentMode = "hosted" | "selfhosted";

/** Canonical org-create channels (program plan §1.1a). */
export type OrgProvisionSource =
	| "hosted_signup"
	| "hosted_dashboard"
	| "selfhost_bootstrap"
	| "selfhost_cli"
	| "dev";

type EditionPolicyTestOverrides = {
	edition?: EnvSyncEdition;
	deployment_mode?: EnvSyncDeploymentMode;
	management_enabled?: boolean;
	landing_enabled?: boolean;
	management_web_enabled?: boolean;
	observability_enabled?: boolean;
	single_org_mode?: boolean;
	license_enforcement?: boolean;
	max_orgs?: number | null;
	public_org_signup_enabled?: boolean;
};

function parseBoolean(value: string | undefined, fallback = false) {
	if (value === undefined) {
		return fallback;
	}

	return value === "true";
}

function parsePositiveInt(value: string | undefined): number | null {
	if (value === undefined || value.trim() === "") {
		return null;
	}
	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n) || n < 1) {
		return null;
	}
	return n;
}

/**
 * Edition / install / org-create channel policy.
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

	/**
	 * Hosted multi-tenant SaaS vs self-hosted product install.
	 * Defaults: OSS → selfhosted; enterprise without env → hosted (local/e2e compat).
	 * Self-host deploys must set ENVSYNC_DEPLOYMENT_MODE=selfhosted.
	 */
	public static getDeploymentMode(): EnvSyncDeploymentMode {
		if (this.#testOverrides?.deployment_mode) {
			return this.#testOverrides.deployment_mode;
		}
		if (config.ENVSYNC_DEPLOYMENT_MODE === "hosted" || config.ENVSYNC_DEPLOYMENT_MODE === "selfhosted") {
			return config.ENVSYNC_DEPLOYMENT_MODE;
		}
		if (this.isOss()) {
			return "selfhosted";
		}
		return "hosted";
	}

	public static isHosted() {
		return this.getDeploymentMode() === "hosted";
	}

	public static isSelfhosted() {
		return this.getDeploymentMode() === "selfhosted";
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
		if (this.isSelfhosted()) {
			// Self-host defaults to single-org until Phase 4 multi-org claims (CLI only).
			const max = this.getMaxOrgs();
			return max === 1;
		}
		return this.isOss() || parseBoolean(config.ENVSYNC_SINGLE_ORG_MODE, false);
	}

	/**
	 * Max organizations for this install.
	 * Hosted: unlimited (null). Self-host: 1 by default; ENVSYNC_MAX_ORGS for CLI interim only.
	 */
	public static getMaxOrgs(): number | null {
		if (this.#testOverrides?.max_orgs !== undefined) {
			return this.#testOverrides.max_orgs;
		}
		if (this.isHosted()) {
			return null;
		}
		const fromEnv = parsePositiveInt(config.ENVSYNC_MAX_ORGS);
		if (fromEnv !== null && this.isEnterprise()) {
			return fromEnv;
		}
		return 1;
	}

	/** Public email org signup (landing → onboarding org*). Hosted only. */
	public static isPublicOrgSignupEnabled() {
		if (this.#testOverrides?.public_org_signup_enabled !== undefined) {
			return this.#testOverrides.public_org_signup_enabled;
		}
		return this.isHosted();
	}

	/** Dashboard / cookie session create-organization. Hosted only. */
	public static canCreateOrganizationViaWeb() {
		return this.isHosted();
	}

	public static requiresEnterpriseLicense() {
		const enforced = this.#testOverrides?.license_enforcement
			?? parseBoolean(config.ENVSYNC_LICENSE_ENFORCEMENT, false);
		return this.isEnterprise() && enforced;
	}

	/** Normalize legacy provision sources to canonical channels. */
	public static normalizeProvisionSource(source: string): OrgProvisionSource {
		switch (source) {
			case "hosted_signup":
			case "org_invite_accept":
			case "org_invite":
				return "hosted_signup";
			case "hosted_dashboard":
			case "workspace_switcher":
			case "create_workspace":
				return "hosted_dashboard";
			case "selfhost_bootstrap":
				return "selfhost_bootstrap";
			case "selfhost_cli":
			case "operator":
				return "selfhost_cli";
			case "dev":
			case "create-dev-user":
			case "bootstrap-ui-harness":
			case "bootstrap-org":
			case "cli_bootstrap":
			case "cli":
			case "seed":
			case "cli_seed":
				// Operator/dev scripts — allowed on hosted and selfhosted (max_orgs still applies on selfhost).
				return "dev";
			default:
				if (source.startsWith("selfhost_")) {
					return source.includes("bootstrap") ? "selfhost_bootstrap" : "selfhost_cli";
				}
				return "dev";
		}
	}

	public static assertPublicOrgSignupEnabled() {
		if (!this.isPublicOrgSignupEnabled()) {
			throw new ForbiddenError(
				"Public organization signup is disabled on this deployment.",
				"PUBLIC_ORG_SIGNUP_DISABLED",
			);
		}
	}

	/**
	 * Assert the caller channel may create an org, then enforce max_orgs.
	 * Web channels never use ENVSYNC_MAX_ORGS to unlock self-host multi-org.
	 */
	public static assertCanProvisionOrg(input: {
		source: string;
		orgCount: number;
	}) {
		const channel = this.normalizeProvisionSource(input.source);
		const mode = this.getDeploymentMode();

		const channelAllowed = this.isChannelAllowed(channel, mode);
		if (!channelAllowed) {
			throw new ForbiddenError(
				"Organization creation is not allowed through this channel on this deployment.",
				"ORG_CREATE_CHANNEL_FORBIDDEN",
			);
		}

		const maxOrgs = this.getMaxOrgsForChannel(channel);
		if (maxOrgs !== null && input.orgCount >= maxOrgs) {
			throw new ConflictError(
				"This deployment is limited to a single organization.",
				"ORG_LIMIT_REACHED",
			);
		}
	}

	/**
	 * @deprecated Prefer assertCanProvisionOrg with source. Kept for callers that only have orgCount;
	 * uses single-org / max_orgs without channel (CLI bootstrap paths should pass source).
	 */
	public static assertOrgProvisioningAllowed(orgCount: number) {
		const maxOrgs = this.getMaxOrgs();
		if (maxOrgs !== null && orgCount >= maxOrgs) {
			throw new ConflictError(
				"This deployment is limited to a single organization.",
				"ORG_LIMIT_REACHED",
			);
		}
		// Legacy alias for OSS single-org when hosted multi-org disabled via SINGLE_ORG_MODE
		if (this.isHosted() && this.isSingleOrgMode() && orgCount >= 1) {
			throw new ConflictError(
				"This deployment is limited to a single organization.",
				"ORG_LIMIT_REACHED",
			);
		}
	}

	/** Policy snapshot for system status / whoami. */
	public static getPolicySnapshot() {
		return {
			edition: this.getEdition(),
			deployment_mode: this.getDeploymentMode(),
			single_org_mode: this.isSingleOrgMode(),
			max_orgs: this.getMaxOrgs(),
			public_signup_enabled: this.isPublicOrgSignupEnabled(),
			can_create_organization: this.canCreateOrganizationViaWeb(),
			management_enabled: this.isManagementEnabled(),
			observability_enabled: this.isObservabilityEnabled(),
			management_web_enabled: this.isManagementWebEnabled(),
			landing_enabled: this.isLandingEnabled(),
		};
	}

	private static isChannelAllowed(channel: OrgProvisionSource, mode: EnvSyncDeploymentMode): boolean {
		if (mode === "hosted") {
			return channel === "hosted_signup"
				|| channel === "hosted_dashboard"
				|| channel === "dev";
		}
		// selfhosted
		return channel === "selfhost_bootstrap"
			|| channel === "selfhost_cli"
			|| channel === "dev";
	}

	/**
	 * Web channels on self-host always max 1 effectively via channel deny.
	 * CLI may use ENVSYNC_MAX_ORGS interim (enterprise only).
	 */
	private static getMaxOrgsForChannel(channel: OrgProvisionSource): number | null {
		if (channel === "hosted_signup" || channel === "hosted_dashboard") {
			// Hosted unlimited unless single_org_mode forced
			if (this.isHosted() && !this.isSingleOrgMode()) {
				return null;
			}
			return this.getMaxOrgs() ?? 1;
		}
		if (channel === "selfhost_cli" || channel === "selfhost_bootstrap" || channel === "dev") {
			return this.getMaxOrgs() ?? 1;
		}
		return 1;
	}
}

/** @deprecated Use ORG_LIMIT_REACHED; kept for response compatibility. */
export const ORG_LIMIT_REACHED_LEGACY_CODE = "OSS_SINGLE_ORG_LIMIT_REACHED";
