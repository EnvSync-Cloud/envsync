import { afterEach, describe, expect, test } from "bun:test";

import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";

afterEach(() => {
	OrgFeatureGrantService.clearTestOverrides();
});

describe("OrgFeatureGrantService.patchGrant", () => {
	test("overlay patch keeps the existing plan", async () => {
		OrgFeatureGrantService.setTestOverrides({
			grant: {
				org_id: "org_dev",
				plan: "developer",
				features: [],
				limits: null,
				overlay_features: [],
				source: "signup",
				updated_by: null,
				created_at: "2026-09-18T00:00:00.000Z",
				updated_at: "2026-09-18T00:00:00.000Z",
			},
		});

		const grant = await OrgFeatureGrantService.patchGrant({
			orgId: "org_dev",
			overlay_features: ["change_requests", "saml"],
			source: "support",
			updatedBy: "ops",
		});

		expect(grant.plan).toBe("developer");
		expect(grant.overlay_features).toEqual(["change_requests", "saml"]);
		expect(grant.features).toEqual([]);
	});

	test("plan patch keeps the existing overlay", async () => {
		OrgFeatureGrantService.setTestOverrides({
			grant: {
				org_id: "org_dev",
				plan: "developer",
				features: [],
				limits: null,
				overlay_features: ["change_requests"],
				source: "support",
				updated_by: "ops",
				created_at: "2026-09-18T00:00:00.000Z",
				updated_at: "2026-09-18T00:00:00.000Z",
			},
		});

		const grant = await OrgFeatureGrantService.patchGrant({
			orgId: "org_dev",
			plan: "plus",
			source: "support",
			updatedBy: "ops",
		});

		expect(grant.plan).toBe("plus");
		expect(grant.overlay_features).toEqual(["change_requests"]);
	});
});
