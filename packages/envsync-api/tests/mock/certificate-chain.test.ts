import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { CertificateService } from "@/services/certificate.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { seedOrg, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

let seed: SeedOrgResult;

beforeAll(async () => {
	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
	});
	await CertificateService.initOrgCA(seed.org.id, "Chain Org", seed.masterUser.id);
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
			plan: "enterprise",
			features: [],
			limits: null,
			overlay_features: [],
			source: "support",
			updated_by: "test",
			created_at: "2026-09-18T00:00:00.000Z",
			updated_at: "2026-09-18T00:00:00.000Z",
		},
	});
}

describe("CertificateService chain import", () => {
	test("getChain includes org CA and imported PEM", async () => {
		entitleCertificates();
		const imported = await CertificateService.importChain({
			org_id: seed.org.id,
			user_id: seed.masterUser.id,
			chain_pem: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
			description: "External root",
		});
		expect(imported.cert_type).toBe("imported_chain");
		const chain = await CertificateService.getChain(seed.org.id);
		expect(chain.imported_count).toBeGreaterThanOrEqual(1);
		expect(chain.chain_pem).toContain("BEGIN CERTIFICATE");
		expect(chain.org_ca_pem).toBeTruthy();
	});
});
