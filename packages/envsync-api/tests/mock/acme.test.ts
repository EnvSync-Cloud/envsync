import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { CertificateService } from "@/services/certificate.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { AcmeService } from "envsync-enterprise";
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
	await CertificateService.initOrgCA(seed.org.id, "ACME Org", seed.masterUser.id);
});

afterEach(() => {
	resetVaultStore();
	EditionPolicyService.clearTestOverrides();
	OrgFeatureGrantService.clearTestOverrides();
});

function entitle() {
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

describe("AcmeService", () => {
	test("creates an account and order for an internal name", async () => {
		entitle();
		const eab = await AcmeService.createEab(seed.org.id, seed.masterUser.id);
		const account = await AcmeService.newAccount({
			orgSlug: seed.org.slug,
			kid: eab.kid,
			hmac_key: eab.hmac_key,
			jwk_thumbprint: "test-thumb",
		});
		const order = await AcmeService.newOrder({
			orgSlug: seed.org.slug,
			account_id: account.id,
			identifiers: [{ type: "dns", value: "app.internal" }],
		});
		expect(order.status).toBe("ready");
	});

	test("rejects public hostnames", async () => {
		entitle();
		const eab = await AcmeService.createEab(seed.org.id, seed.masterUser.id);
		const account = await AcmeService.newAccount({
			orgSlug: seed.org.slug,
			kid: eab.kid,
			hmac_key: eab.hmac_key,
			jwk_thumbprint: "test-thumb-2",
		});
		await expect(
			AcmeService.newOrder({
				orgSlug: seed.org.slug,
				account_id: account.id,
				identifiers: [{ type: "dns", value: "example.com" }],
			}),
		).rejects.toThrow(/not allowed/);
	});
});
