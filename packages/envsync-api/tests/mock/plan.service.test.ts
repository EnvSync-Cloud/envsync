import { afterEach, describe, expect, test } from "bun:test";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { PlanService } from "@/services/plan.service";
import { config } from "@/utils/env";

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
	delete (config as { ENVSYNC_PLAN?: string }).ENVSYNC_PLAN;
	delete (config as { ENVSYNC_HOSTED_DEFAULT_PLAN?: string }).ENVSYNC_HOSTED_DEFAULT_PLAN;
});

describe("PlanService.resolve", () => {
	test("Hosted missing grant grandfathers enterprise", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({ grant: null });
		const resolved = await PlanService.resolve("org_legacy");
		expect(resolved.plan).toBe("enterprise");
		expect(resolved.source).toBe("hosted_default");
		expect(resolved.features).toContain("kms");
	});

	test("Hosted grant plan wins", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({
			grant: {
				org_id: "org_dev",
				plan: "developer",
				features: [],
				limits: null,
				source: "signup",
				updated_by: null,
				created_at: "2026-09-18T00:00:00.000Z",
				updated_at: "2026-09-18T00:00:00.000Z",
			},
		});
		const resolved = await PlanService.resolve("org_dev");
		expect(resolved.plan).toBe("developer");
		expect(resolved.limits.max_projects).toBe(5);
		expect(resolved.features).toEqual([]);
		expect(resolved.overlay_features).toEqual([]);
		expect(resolved.source).toBe("signup");
	});

	test("Hosted overlay unions plan defaults without changing numeric caps", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({
			grant: {
				org_id: "org_trial",
				plan: "developer",
				features: [],
				limits: null,
				overlay_features: ["change_requests", "saml"],
				source: "support",
				updated_by: "ops",
				created_at: "2026-09-18T00:00:00.000Z",
				updated_at: "2026-09-18T00:00:00.000Z",
			},
		});
		const resolved = await PlanService.resolve("org_trial");
		expect(resolved.plan).toBe("developer");
		expect(resolved.limits.max_projects).toBe(5);
		expect(resolved.limits.max_members).toBe(3);
		expect(resolved.limits.change_requests).toBe(true);
		expect(resolved.limits.sso).toBe(true);
		expect(resolved.features).toEqual(["saml"]);
		expect(resolved.overlay_features).toEqual(["change_requests", "saml"]);
	});

	test("OSS install defaults to free Plus+ limits with no EE features", async () => {
		EditionPolicyService.setTestOverrides({ edition: "oss", deployment_mode: "selfhosted" });
		const resolved = await PlanService.resolve("org_oss");
		expect(resolved.plan).toBe("plus");
		expect(resolved.limits.max_orgs).toBe(1);
		expect(resolved.limits.max_members).toBe(30);
		expect(resolved.limits.change_requests).toBe(true);
		expect(resolved.features).toEqual([]);
		expect(resolved.source).toBe("install");
	});
});
