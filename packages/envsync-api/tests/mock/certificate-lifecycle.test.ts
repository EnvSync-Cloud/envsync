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
	await CertificateService.initOrgCA(seed.org.id, "Lifecycle Org", seed.masterUser.id);
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

describe("CertificateService.processLifecycle", () => {
	test("marks past-due certs expired and notifies once per day for upcoming expiry", async () => {
		entitleCertificates();
		const cert = await CertificateService.issueLeaf({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			common_name: "expire.internal",
			ttl_days: 90,
		});
		const db = await DB.getInstance();
		await db
			.updateTable("org_certificates")
			.set({ not_after: new Date("2020-01-01T00:00:00.000Z") })
			.where("id", "=", cert.id)
			.execute();

		const first = await CertificateService.processLifecycle(new Date("2026-09-19T00:00:00.000Z"));
		expect(first.expired).toBeGreaterThanOrEqual(1);

		const stored = await CertificateService.getCertificate(cert.id);
		expect(stored.status).toBe("expired");

		const second = await CertificateService.processLifecycle(new Date("2026-09-19T01:00:00.000Z"));
		expect(second.expired).toBe(0);
	});

	test("emits cert_expiring for certs inside the 30-day window", async () => {
		entitleCertificates();
		const cert = await CertificateService.issueLeaf({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			common_name: "soon.internal",
			ttl_days: 90,
		});
		const now = new Date("2026-09-19T00:00:00.000Z");
		const db = await DB.getInstance();
		await db
			.updateTable("org_certificates")
			.set({ not_after: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) })
			.where("id", "=", cert.id)
			.execute();

		const first = await CertificateService.processLifecycle(now);
		expect(first.expiring).toBeGreaterThanOrEqual(1);
		const second = await CertificateService.processLifecycle(now);
		expect(second.expiring).toBe(0);
	});
});
