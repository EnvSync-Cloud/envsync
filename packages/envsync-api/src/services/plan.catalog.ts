import {
	ALL_ENTERPRISE_FEATURES,
	isEnterpriseFeature,
	type EnterpriseFeature,
} from "@/services/entitlement.types";
import { EditionPolicyService } from "@/services/edition-policy.service";

export const PLAN_IDS = ["developer", "plus", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export function isPlanId(value: string): value is PlanId {
	return (PLAN_IDS as readonly string[]).includes(value);
}

export type PlanLimits = {
	max_orgs: number | null;
	max_projects: number | null;
	max_members: number | null;
	max_api_keys: number | null;
	max_webhooks: number | null;
	audit_retention_days: number | null;
	change_requests: boolean;
	point_in_time: boolean;
	byok_secrets: boolean;
	managed_secrets: boolean;
	sso: boolean;
	integrations: boolean;
	rotation: boolean;
	certificates: boolean;
};

const DEVELOPER_LIMITS: PlanLimits = {
	max_orgs: 1,
	max_projects: 5,
	max_members: 3,
	max_api_keys: 2,
	max_webhooks: 1,
	audit_retention_days: 14,
	change_requests: false,
	point_in_time: false,
	byok_secrets: false,
	managed_secrets: true,
	sso: false,
	integrations: false,
	rotation: false,
	certificates: false,
};

function plusLimits(maxOrgs: number): PlanLimits {
	return {
		max_orgs: maxOrgs,
		max_projects: null,
		max_members: 30,
		max_api_keys: 10,
		max_webhooks: 5,
		audit_retention_days: 60,
		change_requests: true,
		point_in_time: true,
		byok_secrets: true,
		managed_secrets: true,
		sso: true,
		integrations: true,
		rotation: true,
		certificates: false,
	};
}

const ENTERPRISE_LIMITS: PlanLimits = {
	max_orgs: null,
	max_projects: null,
	max_members: null,
	max_api_keys: null,
	max_webhooks: null,
	audit_retention_days: null,
	change_requests: true,
	point_in_time: true,
	byok_secrets: true,
	managed_secrets: true,
	sso: true,
	integrations: true,
	rotation: true,
	certificates: true,
};

const PLUS_EE_FEATURES: EnterpriseFeature[] = ["oidc", "saml", "rotation", "integrations"];

export function limitsForPlan(plan: PlanId, channel: "hosted" | "oss_selfhost" = "hosted"): PlanLimits {
	if (plan === "developer") return { ...DEVELOPER_LIMITS };
	if (plan === "enterprise") return { ...ENTERPRISE_LIMITS };
	return plusLimits(channel === "oss_selfhost" ? 1 : 3);
}

export function eeFeaturesForPlan(plan: PlanId): EnterpriseFeature[] {
	if (plan === "developer") return [];
	if (plan === "plus") return [...PLUS_EE_FEATURES];
	return [...ALL_ENTERPRISE_FEATURES];
}

export function planChannel(): "hosted" | "oss_selfhost" {
	if (EditionPolicyService.isHosted()) return "hosted";
	return "oss_selfhost";
}

export function parsePlanId(value: string | null | undefined, fallback: PlanId = "developer"): PlanId {
	if (value && isPlanId(value)) return value;
	return fallback;
}

/** Hosted trial toggles. Additive only — never lowers plan defaults or numeric caps. */
export const HOSTED_OVERLAY_FLAGS = [
	"change_requests",
	"point_in_time",
	"byok_secrets",
	"certificates",
	"oidc",
	"saml",
	"rotation",
	"dynamic_secrets",
	"log_forwarding",
	"integrations",
	"kms",
] as const;

export type HostedOverlayFlag = (typeof HOSTED_OVERLAY_FLAGS)[number];

export function isHostedOverlayFlag(value: string): value is HostedOverlayFlag {
	return (HOSTED_OVERLAY_FLAGS as readonly string[]).includes(value);
}

export function normalizeOverlayFeatures(raw: readonly string[] | null | undefined): HostedOverlayFlag[] {
	const seen = new Set<HostedOverlayFlag>();
	for (const value of raw ?? []) {
		if (isHostedOverlayFlag(value)) {
			seen.add(value);
		}
	}
	return [...seen];
}

export function applyOverlay(
	limits: PlanLimits,
	features: readonly EnterpriseFeature[],
	overlay: readonly string[] | null | undefined,
): { limits: PlanLimits; features: EnterpriseFeature[] } {
	const flags = normalizeOverlayFeatures(overlay);
	const nextLimits = { ...limits };
	const nextFeatures = new Set(features);

	for (const flag of flags) {
		if (flag === "change_requests") {
			nextLimits.change_requests = true;
			continue;
		}
		if (flag === "point_in_time") {
			nextLimits.point_in_time = true;
			continue;
		}
		if (flag === "byok_secrets") {
			nextLimits.byok_secrets = true;
			continue;
		}
		if (flag === "certificates") {
			nextLimits.certificates = true;
			continue;
		}
		if (flag === "oidc" || flag === "saml") {
			nextLimits.sso = true;
		}
		if (flag === "rotation") {
			nextLimits.rotation = true;
		}
		if (flag === "integrations") {
			nextLimits.integrations = true;
		}
		if (isEnterpriseFeature(flag) && flag !== "multi_org") {
			nextFeatures.add(flag);
		}
	}

	return { limits: nextLimits, features: [...nextFeatures] };
}
