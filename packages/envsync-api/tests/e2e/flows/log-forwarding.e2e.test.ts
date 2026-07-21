/**
 * E2E: Log Forwarding Config CRUD — create → list → get → delete
 *
 * Uses real PostgreSQL and OpenFGA.
 * Tests the log forwarding configuration management surface.
 * Supports Datadog, Splunk, and Sumo Logic providers.
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

describe("Log Forwarding E2E", () => {
	let configId: string;

	test("create Datadog log forwarding config", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Datadog Config",
				provider_type: "datadog",
				config: {
					api_key: "dd-e2e-api-key-12345",
					site: "datadoghq.com",
					service: "envsync-e2e",
					source: "envsync-api",
				},
				enabled: true,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			org_id: string;
			name: string;
			provider_type: string;
			enabled: boolean;
		}>();
		expect(body.id).toBeDefined();
		expect(body.org_id).toBe(seed.org.id);
		expect(body.name).toBe("E2E Datadog Config");
		expect(body.provider_type).toBe("datadog");
		expect(body.enabled).toBe(true);
		configId = body.id;
	});

	test("list log forwarding configs returns created config", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; name: string; provider_type: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.some((c) => c.id === configId && c.name === "E2E Datadog Config")).toBe(true);
	});

	test("get log forwarding config by ID", async () => {
		const res = await managementTestRequest(`/api/log_forwarding/${configId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			name: string;
			provider_type: string;
			config: Record<string, unknown>;
		}>();
		expect(body.id).toBe(configId);
		expect(body.name).toBe("E2E Datadog Config");
		expect(body.provider_type).toBe("datadog");
		expect(body.config).toBeDefined();
	});

	test("delete log forwarding config", async () => {
		const res = await managementTestRequest(`/api/log_forwarding/${configId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Log forwarding config deleted successfully");
	});

	test("get deleted log forwarding config returns 404", async () => {
		const res = await managementTestRequest(`/api/log_forwarding/${configId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(404);
	});

	test("create Splunk log forwarding config", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Splunk Config",
				provider_type: "splunk",
				config: {
					token: "splunk-hec-token-e2e",
					endpoint: "https://splunk.example.com:8088/services/collector",
					source: "envsync",
					index: "main",
				},
				enabled: true,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; provider_type: string }>();
		expect(body.provider_type).toBe("splunk");

		// Clean up
		await managementTestRequest(`/api/log_forwarding/${body.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
	});

	test("create Sumo Logic log forwarding config", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Sumo Logic Config",
				provider_type: "sumo-logic",
				config: {
					url: "https://collectors.sumologic.com/receiver/v1/http/e2e-endpoint",
				},
				enabled: true,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; provider_type: string }>();
		expect(body.provider_type).toBe("sumo-logic");

		// Clean up
		await managementTestRequest(`/api/log_forwarding/${body.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
	});

	test("create log forwarding config with invalid provider_type returns 400", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Bad Provider Config",
				provider_type: "unsupported_provider",
				config: { api_key: "test" },
			},
		});
		expect(res.status).toBe(400);
	});

	test("create log forwarding config with mismatched config returns 400", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Mismatched Config",
				provider_type: "datadog",
				config: {
					// Datadog requires api_key, but we're passing Splunk fields
					token: "wrong-field",
					endpoint: "https://splunk.example.com",
				},
			},
		});
		expect(res.status).toBe(400);
	});

	test("create log forwarding config with missing name returns 400", async () => {
		const res = await managementTestRequest("/api/log_forwarding", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				provider_type: "datadog",
				config: {
					api_key: "test-key",
				},
				// missing name
			},
		});
		expect(res.status).toBe(400);
	});
});
