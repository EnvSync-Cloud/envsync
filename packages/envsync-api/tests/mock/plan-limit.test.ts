import { afterEach, describe, expect, test } from "bun:test";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { PlanLimitService } from "@/services/plan_limit.service";

function grant(plan: "developer" | "plus" | "enterprise", orgId = "org_plan") {
	return {
		org_id: orgId,
		plan,
		features: [],
		limits: null,
		source: "test",
		updated_by: null,
		created_at: "2026-09-18T00:00:00.000Z",
		updated_at: "2026-09-18T00:00:00.000Z",
	};
}

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
});

describe("PlanLimitService", () => {
	test("Developer cannot use change requests or PiT", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({ grant: grant("developer") });
		await expect(PlanLimitService.assertFeature("org_plan", "change_requests")).rejects.toMatchObject({
			code: "PLAN_FEATURE_REQUIRED",
		});
		await expect(PlanLimitService.assertFeature("org_plan", "point_in_time")).rejects.toMatchObject({
			code: "PLAN_FEATURE_REQUIRED",
		});
		await expect(PlanLimitService.assertFeature("org_plan", "byok_secrets")).rejects.toMatchObject({
			code: "PLAN_FEATURE_REQUIRED",
		});
	});

	test("Plus+ allows change requests and PiT", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({ grant: grant("plus") });
		await expect(PlanLimitService.assertFeature("org_plan", "change_requests")).resolves.toMatchObject({
			plan: "plus",
		});
		await expect(PlanLimitService.assertFeature("org_plan", "point_in_time")).resolves.toMatchObject({
			plan: "plus",
		});
	});

	test("Developer project cap is 5", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		OrgFeatureGrantService.setTestOverrides({ grant: grant("developer") });
		const resolved = await PlanLimitService.resolve("org_plan");
		expect(resolved.limits.max_projects).toBe(5);
		expect(resolved.limits.max_members).toBe(3);
		expect(resolved.limits.max_api_keys).toBe(2);
		expect(resolved.limits.max_webhooks).toBe(1);
	});
});
