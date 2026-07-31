import { afterEach, describe, expect, test } from "bun:test";

import { EditionPolicyService } from "@/services/edition-policy.service";

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
});

describe("EditionPolicyService channel matrix", () => {
	test("hosted allows public signup and web org create", () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
		});
		expect(EditionPolicyService.getDeploymentMode()).toBe("hosted");
		expect(EditionPolicyService.isPublicOrgSignupEnabled()).toBe(true);
		expect(EditionPolicyService.canCreateOrganizationViaWeb()).toBe(true);
		expect(EditionPolicyService.getMaxOrgs()).toBeNull();
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "hosted_dashboard", orgCount: 5 }),
		).not.toThrow();
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "hosted_signup", orgCount: 0 }),
		).not.toThrow();
	});

	test("selfhosted denies public signup and web org create", () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			max_orgs: 5,
		});
		expect(EditionPolicyService.isPublicOrgSignupEnabled()).toBe(false);
		expect(EditionPolicyService.canCreateOrganizationViaWeb()).toBe(false);
		expect(() => EditionPolicyService.assertPublicOrgSignupEnabled()).toThrow(
			expect.objectContaining({ code: "PUBLIC_ORG_SIGNUP_DISABLED" }),
		);
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "hosted_dashboard", orgCount: 0 }),
		).toThrow(expect.objectContaining({ code: "ORG_CREATE_CHANNEL_FORBIDDEN" }));
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "hosted_signup", orgCount: 0 }),
		).toThrow(expect.objectContaining({ code: "ORG_CREATE_CHANNEL_FORBIDDEN" }));
	});

	test("selfhosted CLI respects max_orgs interim override", () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			max_orgs: 2,
		});
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "selfhost_cli", orgCount: 0 }),
		).not.toThrow();
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "selfhost_cli", orgCount: 1 }),
		).not.toThrow();
		expect(() =>
			EditionPolicyService.assertCanProvisionOrg({ source: "selfhost_cli", orgCount: 2 }),
		).toThrow(expect.objectContaining({ code: "ORG_LIMIT_REACHED" }));
	});

	test("oss defaults to selfhosted single-org", () => {
		EditionPolicyService.setTestOverrides({ edition: "oss" });
		expect(EditionPolicyService.getDeploymentMode()).toBe("selfhosted");
		expect(EditionPolicyService.getMaxOrgs()).toBe(1);
		expect(EditionPolicyService.canCreateOrganizationViaWeb()).toBe(false);
	});

	test("normalizes legacy sources", () => {
		expect(EditionPolicyService.normalizeProvisionSource("workspace_switcher")).toBe("hosted_dashboard");
		expect(EditionPolicyService.normalizeProvisionSource("org_invite_accept")).toBe("hosted_signup");
		expect(EditionPolicyService.normalizeProvisionSource("cli_bootstrap")).toBe("dev");
	});

	test("policy snapshot exposes Phase 1 fields", () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			max_orgs: 1,
		});
		const snap = EditionPolicyService.getPolicySnapshot();
		expect(snap.deployment_mode).toBe("selfhosted");
		expect(snap.can_create_organization).toBe(false);
		expect(snap.public_signup_enabled).toBe(false);
		expect(snap.max_orgs).toBe(1);
	});
});
