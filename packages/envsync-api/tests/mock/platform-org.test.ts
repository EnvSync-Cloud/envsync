import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgProvisioningService } from "@/services/org-provisioning.service";
import { PlatformOrgService } from "@/services/platform-org.service";
import { config } from "@/utils/env";

const originalToken = config.ENVSYNC_PLATFORM_ADMIN_TOKEN;

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
	(config as { ENVSYNC_PLATFORM_ADMIN_TOKEN?: string }).ENVSYNC_PLATFORM_ADMIN_TOKEN = originalToken;
});

describe("hosted_ops provision channel", () => {
	test("normalizes SuperAdmin aliases", () => {
		expect(EditionPolicyService.normalizeProvisionSource("hosted_ops")).toBe("hosted_ops");
		expect(EditionPolicyService.normalizeProvisionSource("superadmin")).toBe("hosted_ops");
		expect(EditionPolicyService.normalizeProvisionSource("support")).toBe("hosted_ops");
	});

	test("is allowed on Hosted and forbidden on self-host", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		await expect(OrgProvisioningService.assertProvisioningAllowed("hosted_ops")).resolves.toBeUndefined();

		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "selfhosted" });
		await expect(OrgProvisioningService.assertProvisioningAllowed("hosted_ops")).rejects.toMatchObject({
			code: "ORG_CREATE_CHANNEL_FORBIDDEN",
			statusCode: 403,
		});
	});
});

describe("POST /api/platform/organizations", () => {
	test("rejects missing platform token", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		(config as { ENVSYNC_PLATFORM_ADMIN_TOKEN?: string }).ENVSYNC_PLATFORM_ADMIN_TOKEN = "platform-token";
		const { default: platformRouter } = await import("@/routes/platform.route");
		const app = new Hono().route("/api/platform", platformRouter);
		const res = await app.request("http://localhost/api/platform/organizations", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				mode: "fresh_tenant",
				organization_name: "Acme",
				admin_email: "owner@acme.test",
			}),
		});
		expect(res.status).toBe(401);
	});

	test("provisions via PlatformOrgService when the token matches", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", deployment_mode: "hosted" });
		(config as { ENVSYNC_PLATFORM_ADMIN_TOKEN?: string }).ENVSYNC_PLATFORM_ADMIN_TOKEN = "platform-token";
		const original = PlatformOrgService.provision;
		PlatformOrgService.provision = async () => ({
			org_id: "org-1",
			org_name: "Acme",
			org_slug: "acme",
			user_id: "user-1",
			auth_service_id: "idp-1",
			plan: "plus",
			overlay_features: ["change_requests"],
			mode: "fresh_tenant",
		});
		try {
			const { default: platformRouter } = await import("@/routes/platform.route");
			const app = new Hono().route("/api/platform", platformRouter);
			const res = await app.request("http://localhost/api/platform/organizations", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-EnvSync-Platform-Token": "platform-token",
				},
				body: JSON.stringify({
					mode: "fresh_tenant",
					organization_name: "Acme",
					admin_email: "owner@acme.test",
					plan: "plus",
				}),
			});
			expect(res.status).toBe(201);
			expect(await res.json()).toMatchObject({ org_slug: "acme", plan: "plus" });
		} finally {
			PlatformOrgService.provision = original;
		}
	});
});
