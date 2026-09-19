import { afterEach, beforeAll, describe, expect, test } from "bun:test";

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
	await CertificateService.initOrgCA(seed.org.id, "Leaf Test Org", seed.masterUser.id);
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

describe("CertificateService leaf + CSR", () => {
	test("issues a project leaf with SANs", async () => {
		entitleCertificates();
		const cert = await CertificateService.issueLeaf({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			common_name: "api.internal",
			sans: ["api.internal", "127.0.0.1"],
			ttl_days: 30,
		});
		expect(cert.cert_type).toBe("leaf");
		expect(cert.subject_cn).toBe("api.internal");
		expect(cert.app_id).toBe(appId);
		expect(cert.sans).toContain("api.internal");
		expect(cert.key_pem).toContain("BEGIN");
	});

	test("signs a CSR without returning a private key", async () => {
		entitleCertificates();
		const cert = await CertificateService.signCsr({
			org_id: seed.org.id,
			app_id: appId,
			issued_by_user_id: seed.masterUser.id,
			csr_pem: "-----BEGIN CERTIFICATE REQUEST-----\nMIIB\n-----END CERTIFICATE REQUEST-----",
			ttl_days: 30,
		});
		expect(cert.cert_type).toBe("leaf");
		expect((cert as { key_pem?: string }).key_pem).toBeUndefined();
	});
});
