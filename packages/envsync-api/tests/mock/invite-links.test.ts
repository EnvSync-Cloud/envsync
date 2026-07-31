import { afterEach, describe, expect, test } from "bun:test";

import { orgInviteAcceptLink, userInviteAcceptLink } from "@/helpers/invite-links";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { config } from "@/utils/env";

const original = {
	DASHBOARD_URL: config.DASHBOARD_URL,
	LANDING_PAGE_URL: config.LANDING_PAGE_URL,
};

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
	Object.assign(config, original);
});

describe("invite-links", () => {
	test("selfhosted user invites use dashboard URL", () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "selfhosted", edition: "oss" });
		Object.assign(config, {
			DASHBOARD_URL: "https://app.example.com",
			LANDING_PAGE_URL: "https://example.com",
		});
		expect(userInviteAcceptLink("tok123")).toBe(
			"https://app.example.com/onboarding/accept-user-invite/tok123",
		);
	});

	test("hosted user invites prefer landing URL", () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "hosted", edition: "enterprise" });
		Object.assign(config, {
			DASHBOARD_URL: "https://app.example.com",
			LANDING_PAGE_URL: "https://example.com",
		});
		expect(userInviteAcceptLink("tok123")).toBe(
			"https://example.com/onboarding/accept-user-invite/tok123",
		);
	});

	test("hosted org invites use landing URL", () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "hosted", edition: "enterprise" });
		Object.assign(config, {
			DASHBOARD_URL: "https://app.example.com",
			LANDING_PAGE_URL: "https://example.com/",
		});
		expect(orgInviteAcceptLink("code456")).toBe(
			"https://example.com/onboarding/accept-org-invite/code456",
		);
	});
});
