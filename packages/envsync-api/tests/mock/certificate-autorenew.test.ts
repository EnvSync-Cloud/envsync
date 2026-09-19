import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { DB } from "@/libs/db";
import { CertificateService } from "@/services/certificate.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { seedApp, seedOrg, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

let seed: SeedOrgResult;
let appId: string;

beforeAll(async () => {
	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
	});
	const app = await seedApp(seed.org.id);
	appId = app.id;
	await CertificateService.initOrgCA(seed.org.id, "Renew Org", seed.masterUser.id);
});

afterEach(() => {
	resetVaultStore();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
});

function entitleCertificates() {
	EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
	OrgFeatureGrantService.setTestOverrides({
		grant: {
			org_id: seed.org.id,
			plan: "developer",
			features: [],
			limits: null,
			overlay_features: ["certificates"],
			source: "support",
			updated_by: "test",
			created_at: "2026-09-18T00:00:00.000Z",
			updated_at: "2026-09-18T00:00:00.000Z",
		},
	});
}

describe("CertificateService auto-renew", () => {
	test("renews a managed leaf inside the renew window", async () => {
		entitleCertificates();
		const cert = await CertificateService.issueLeaf({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			common_name: "renew.internal",
			ttl_days: 90,
		});
		await CertificateService.setAutoRenew({
			id: cert.id,
			org_id: seed.org.id,
			auto_renew: true,
			renew_days_before: 30,
		});
		const db = await DB.getInstance();
		const now = new Date("2026-09-19T00:00:00.000Z");
		await db
			.updateTable("org_certificates")
			.set({ not_after: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) })
			.where("id", "=", cert.id)
			.execute();

		const result = await CertificateService.processAutoRenewals(now);
		expect(result.renewed).toBeGreaterThanOrEqual(1);
		const previous = await CertificateService.getCertificate(cert.id);
		expect(previous.status).toBe("superseded");
	});

	test("rejects auto-renew on OSS edition", async () => {
		entitleCertificates();
		const cert = await CertificateService.issueLeaf({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			common_name: "oss.internal",
			ttl_days: 90,
		});
		EditionPolicyService.setTestOverrides({ edition: "oss", deployment_mode: "selfhosted" });
		await expect(
			CertificateService.setAutoRenew({
				id: cert.id,
				org_id: seed.org.id,
				auto_renew: true,
			}),
		).rejects.toThrow(/Enterprise/);
	});
});
