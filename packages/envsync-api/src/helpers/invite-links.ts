import { EditionPolicyService } from "@/services/edition-policy.service";
import { config } from "@/utils/env";

function trimSlash(url: string) {
	return url.replace(/\/$/, "");
}

/**
 * User invite accept URL.
 * Self-host: dashboard (no landing). Hosted: landing preferred, dashboard fallback.
 */
export function userInviteAcceptLink(inviteToken: string) {
	const base = EditionPolicyService.isSelfhosted()
		? config.DASHBOARD_URL
		: (config.LANDING_PAGE_URL?.trim() || config.DASHBOARD_URL);
	return `${trimSlash(base)}/onboarding/accept-user-invite/${inviteToken}`;
}

/**
 * Org invite accept URL (public signup — Hosted only).
 * Prefer landing marketing host.
 */
export function orgInviteAcceptLink(inviteCode: string) {
	const base = config.LANDING_PAGE_URL?.trim() || config.DASHBOARD_URL;
	return `${trimSlash(base)}/onboarding/accept-org-invite/${inviteCode}`;
}
