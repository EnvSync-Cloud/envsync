/**
 * E2E: OIDC Provider CRUD — create → list → get → update → delete
 *
 * Uses real PostgreSQL, OpenFGA, and Keycloak.
 * Tests the OIDC provider management surface for CI/CD machine authentication.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { managementTestRequest } from "../helpers/management-request";
import {
	checkServiceHealth,
	seedE2EOrg,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();
});

describe("OIDC Provider E2E", () => {
	let providerId: string;

	test("create OIDC provider for GitHub Actions", async () => {
		const res = await managementTestRequest("/api/oidc", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "github_actions",
				issuer_url: "https://token.actions.githubusercontent.com",
				audience: "https://envsync.cloud",
				allowed_subjects: ["repo:myorg/myrepo:*"],
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			org_id: string;
			provider_type: string;
			issuer_url: string;
			audience: string;
			enabled: boolean;
			allowed_subjects: string[];
		}>();
		expect(body.id).toBeDefined();
		expect(body.org_id).toBe(seed.org.id);
		expect(body.provider_type).toBe("github_actions");
		expect(body.issuer_url).toBe("https://token.actions.githubusercontent.com");
		expect(body.audience).toBe("https://envsync.cloud");
		expect(body.enabled).toBe(true);
		expect(body.allowed_subjects).toEqual(["repo:myorg/myrepo:*"]);
		providerId = body.id;
	});

	test("list OIDC providers returns created provider", async () => {
		const res = await managementTestRequest("/api/oidc", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; provider_type: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.some((p) => p.id === providerId)).toBe(true);
	});

	test("get OIDC provider by ID", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			provider_type: string;
			issuer_url: string;
			audience: string;
		}>();
		expect(body.id).toBe(providerId);
		expect(body.provider_type).toBe("github_actions");
		expect(body.issuer_url).toBe("https://token.actions.githubusercontent.com");
	});

	test("update OIDC provider audience and subjects", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				audience: "https://updated.envsync.cloud",
				allowed_subjects: ["repo:myorg/myrepo:*", "repo:myorg/other:*"],
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("OIDC provider updated successfully.");
	});

	test("verify updated OIDC provider fields", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			audience: string;
			allowed_subjects: string[];
		}>();
		expect(body.audience).toBe("https://updated.envsync.cloud");
		expect(body.allowed_subjects).toEqual([
			"repo:myorg/myrepo:*",
			"repo:myorg/other:*",
		]);
	});

	test("disable OIDC provider", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			method: "PUT",
			token: seed.masterUser.token,
			body: { enabled: false },
		});
		expect(res.status).toBe(200);
	});

	test("delete OIDC provider", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("OIDC provider deleted successfully.");
	});

	test("get deleted OIDC provider returns 404", async () => {
		const res = await managementTestRequest(`/api/oidc/${providerId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(404);
	});

	test("create OIDC provider with missing required fields returns 400", async () => {
		const res = await managementTestRequest("/api/oidc", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "github_actions",
				// missing issuer_url and audience
			},
		});
		expect(res.status).toBe(400);
	});

	test("create OIDC provider with invalid provider_type returns 400", async () => {
		const res = await managementTestRequest("/api/oidc", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "invalid_type",
				issuer_url: "https://token.actions.githubusercontent.com",
				audience: "https://envsync.cloud",
			},
		});
		expect(res.status).toBe(400);
	});

	test("create OIDC provider with invalid URL returns 400", async () => {
		const res = await managementTestRequest("/api/oidc", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "github_actions",
				issuer_url: "not-a-url",
				audience: "https://envsync.cloud",
			},
		});
		expect(res.status).toBe(400);
	});
});
