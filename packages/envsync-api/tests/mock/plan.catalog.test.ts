import { describe, expect, test } from "bun:test";

import { eeFeaturesForPlan, isPlanId, limitsForPlan } from "@/services/plan.catalog";

describe("plan catalog", () => {
	test("parses plan ids", () => {
		expect(isPlanId("developer")).toBe(true);
		expect(isPlanId("plus")).toBe(true);
		expect(isPlanId("enterprise")).toBe(true);
		expect(isPlanId("pro")).toBe(false);
	});

	test("Developer caps projects and members and hides CR/PiT", () => {
		const limits = limitsForPlan("developer");
		expect(limits.max_projects).toBe(5);
		expect(limits.max_members).toBe(3);
		expect(limits.change_requests).toBe(false);
		expect(limits.point_in_time).toBe(false);
		expect(eeFeaturesForPlan("developer")).toEqual([]);
	});

	test("Plus+ is 3 orgs on Hosted and 1 on OSS self-host", () => {
		expect(limitsForPlan("plus", "hosted").max_orgs).toBe(3);
		expect(limitsForPlan("plus", "oss_selfhost").max_orgs).toBe(1);
		expect(limitsForPlan("plus").change_requests).toBe(true);
		expect(eeFeaturesForPlan("plus")).toEqual(expect.arrayContaining(["saml", "oidc", "rotation", "integrations"]));
		expect(eeFeaturesForPlan("plus")).not.toContain("kms");
	});

	test("Enterprise is uncapped", () => {
		const limits = limitsForPlan("enterprise");
		expect(limits.max_orgs).toBeNull();
		expect(limits.max_projects).toBeNull();
		expect(limits.certificates).toBe(true);
		expect(eeFeaturesForPlan("enterprise")).toContain("kms");
	});
});
