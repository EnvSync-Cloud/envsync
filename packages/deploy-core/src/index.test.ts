import { describe, expect, test } from "bun:test";

import { DeployPlanError, createDeploymentPlan } from "./index";

describe("createDeploymentPlan", () => {
	test("builds an OSS topology without management or landing artifacts", () => {
		const plan = createDeploymentPlan({
			edition: "oss",
			domain: {
				root_domain: "oss.example.com",
			},
			observability: {
				enabled: false,
			},
		}, "oss");

		expect(plan.edition).toBe("oss");
		expect(plan.services.find(service => service.id === "management-api")).toBeUndefined();
		expect(plan.services.find(service => service.id === "landing")?.enabled).toBe(false);
		expect(plan.frontend.find(artifact => artifact.id === "management")).toBeUndefined();
		expect(plan.runtime_env.ENVSYNC_MANAGEMENT_ENABLED).toBe("false");
		expect(plan.runtime_env.ENVSYNC_DEPLOYMENT_MODE).toBe("selfhosted");
		expect(plan.runtime_env.ENVSYNC_LANDING_ENABLED).toBe("false");
		expect(plan.runtime_env.ENVSYNC_SINGLE_ORG_MODE).toBe("true");
		expect(plan.runtime_env.ENVSYNC_MAX_ORGS).toBeUndefined();
		expect(plan.warnings).toContain(
			"Observability is disabled for OSS. ClickStack and OTEL services will be omitted.",
		);
	});

	test("builds an enterprise topology with a single dashboard artifact and license env", () => {
		const plan = createDeploymentPlan({
			edition: "enterprise",
			domain: {
				root_domain: "enterprise.example.com",
			},
			license: {
				required: true,
				server_url: "https://licenses.example.com",
				key: "ent-key-123",
				install_fingerprint: "fp-123",
			},
		}, "enterprise");

		expect(plan.edition).toBe("enterprise");
		expect(plan.services.find(service => service.id === "management-api")).toBeUndefined();
		// Landing default off for self-host enterprise (Phase 2).
		expect(plan.services.find(service => service.id === "landing")?.enabled).toBe(false);
		expect(plan.frontend.find(artifact => artifact.id === "landing")?.included).toBe(false);
		expect(plan.frontend.find(artifact => artifact.id === "dashboard")).toMatchObject({
			included: true,
			mount_path: "/",
		});
		expect(plan.frontend.find(artifact => artifact.id === "management")).toBeUndefined();
		expect(plan.runtime_env.MANAGEMENT_API_URL).toBe("https://api.enterprise.example.com/api/v1/manage");
		expect(plan.runtime_env.MANAGEMENT_DASHBOARD_URL).toBeUndefined();
		expect(plan.runtime_env.ENVSYNC_LICENSE_SERVER_URL).toBe("https://licenses.example.com");
		expect(plan.runtime_env.ENVSYNC_DEPLOYMENT_MODE).toBe("selfhosted");
		expect(plan.runtime_env.ENVSYNC_LANDING_ENABLED).toBe("false");
		expect(plan.runtime_env.ENVSYNC_MAX_ORGS).toBeUndefined();
	});

	test("rejects enterprise-invalid topology in OSS mode", () => {
		expect(() => createDeploymentPlan({
			edition: "enterprise",
			features: {
				management_api: true,
				management_web: true,
				landing: true,
			},
			license: {
				required: true,
				server_url: "https://licenses.example.com",
			},
			frontend: {
				dashboard_variant: "enterprise",
				include_manage_subtree: true,
			},
		}, "oss")).toThrow(DeployPlanError);
	});

	test("rejects enterprise topology when required license settings are missing", () => {
		expect(() => createDeploymentPlan({
			edition: "enterprise",
			features: {
				management_api: true,
				management_web: true,
				landing: true,
			},
			license: {
				required: true,
			},
			frontend: {
				dashboard_variant: "enterprise",
				include_manage_subtree: true,
			},
		}, "enterprise")).toThrow("Enterprise edition requires license.server_url.");
	});
});
