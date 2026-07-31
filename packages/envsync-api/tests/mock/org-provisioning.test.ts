import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { cleanupDB, seedOrg } from "../helpers/db";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgProvisioningService } from "@/services/org-provisioning.service";
import { config } from "@/utils/env";

const originalConfig = {
	ENVSYNC_EDITION: config.ENVSYNC_EDITION,
	ENVSYNC_SINGLE_ORG_MODE: config.ENVSYNC_SINGLE_ORG_MODE,
	ENVSYNC_DEPLOYMENT_MODE: config.ENVSYNC_DEPLOYMENT_MODE,
	ENVSYNC_MAX_ORGS: config.ENVSYNC_MAX_ORGS,
};

beforeEach(async () => {
	await cleanupDB();
	EditionPolicyService.clearTestOverrides();
});

afterEach(() => {
	Object.assign(config, originalConfig);
	EditionPolicyService.clearTestOverrides();
});

describe("OrgProvisioningService.assertProvisioningAllowed", () => {
	test("allows the first organization in OSS mode", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "oss",
			ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
			ENVSYNC_SINGLE_ORG_MODE: "false",
		});

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("selfhost_cli"),
		).resolves.toBeUndefined();
	});

	test("rejects a second organization in OSS mode", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "oss",
			ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
			ENVSYNC_SINGLE_ORG_MODE: "false",
		});
		await seedOrg();

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("selfhost_cli"),
		).rejects.toMatchObject({
			code: "ORG_LIMIT_REACHED",
			statusCode: 409,
		});
	});

	test("allows multi-org provisioning in hosted enterprise mode via dashboard channel", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "enterprise",
			ENVSYNC_DEPLOYMENT_MODE: "hosted",
			ENVSYNC_SINGLE_ORG_MODE: "false",
		});
		await seedOrg();

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("hosted_dashboard"),
		).resolves.toBeUndefined();
	});

	test("rejects web dashboard org create on selfhosted enterprise even with MAX_ORGS", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "enterprise",
			ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
			ENVSYNC_MAX_ORGS: "5",
			ENVSYNC_SINGLE_ORG_MODE: "false",
		});

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("hosted_dashboard"),
		).rejects.toMatchObject({
			code: "ORG_CREATE_CHANNEL_FORBIDDEN",
			statusCode: 403,
		});
	});

	test("allows CLI multi-org on selfhosted enterprise when MAX_ORGS allows", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "enterprise",
			ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
			ENVSYNC_MAX_ORGS: "3",
		});
		await seedOrg();

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("selfhost_cli"),
		).resolves.toBeUndefined();
	});

	test("rejects public signup channel on selfhosted", async () => {
		Object.assign(config, {
			ENVSYNC_EDITION: "enterprise",
			ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
		});

		await expect(
			OrgProvisioningService.assertProvisioningAllowed("hosted_signup"),
		).rejects.toMatchObject({
			code: "ORG_CREATE_CHANNEL_FORBIDDEN",
			statusCode: 403,
		});
	});
});

describe("EditionPolicyService public signup", () => {
	test("is enabled only on hosted", () => {
		EditionPolicyService.setTestOverrides({ deployment_mode: "hosted", edition: "enterprise" });
		expect(EditionPolicyService.isPublicOrgSignupEnabled()).toBe(true);

		EditionPolicyService.setTestOverrides({ deployment_mode: "selfhosted", edition: "enterprise" });
		expect(EditionPolicyService.isPublicOrgSignupEnabled()).toBe(false);
		expect(() => EditionPolicyService.assertPublicOrgSignupEnabled()).toThrow(
			expect.objectContaining({ code: "PUBLIC_ORG_SIGNUP_DISABLED" }),
		);
	});
});
