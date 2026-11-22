import { afterEach, expect, spyOn, test } from "bun:test";

import {
	EnterpriseIntegrationService,
	EnterpriseProviderSyncService,
	type EnterpriseSyncContext,
} from "envsync-enterprise";

function context(): EnterpriseSyncContext {
	return {
		org_id: "org",
		app_id: "app",
		env_type_id: "env",
		provider_type: "circleci",
		connection: {
			id: "connection",
			name: "CircleCI",
			provider_type: "circleci",
			auth_config: { api_token: "fixture-token" },
			metadata: {},
		},
		binding: { id: "binding", metadata: { name_prefix: "service" } },
		mapping: {
			id: "mapping",
			target_identifier: "gh/team/repo",
			branch_ref: null,
			path_prefix: null,
			metadata: {},
		},
		items: [{ key: "app.url", value: "example-value", kind: "env" }],
	};
}

const restores: Array<() => void> = [];
afterEach(() => {
	for (const restore of restores.splice(0)) restore();
});

function stubFetch(status = 200) {
	const fetch = spyOn(globalThis, "fetch").mockImplementation(async () => new Response(null, { status }));
	restores.push(() => fetch.mockRestore());
	return fetch;
}

test.each([
	["mapping", "binding", "connection", "legacy", "mapping"],
	[" ", "binding", "connection", "legacy", "binding"],
	[undefined, undefined, "connection", "legacy", "connection"],
])("writes to the highest-priority configured CircleCI context (%#)", async (mapping, binding, connection, legacy, expected) => {
	const input = context();
	input.mapping.metadata.context_id = mapping;
	input.binding.metadata.context_id = binding;
	input.connection.auth_config.context_id = connection;
	input.connection.auth_config.org_id = legacy;
	const fetch = stubFetch();

	expect(await EnterpriseProviderSyncService.sync(input)).toEqual({
		written_count: 1,
		target: { project: "gh/team/repo", context: expected },
	});
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch).toHaveBeenCalledWith(
		`https://circleci.com/api/v2/context/${expected}/environment-variable/SERVICE_APP_URL`,
		expect.objectContaining({
			method: "PUT",
			headers: { "Circle-Token": "fixture-token", "Content-Type": "application/json" },
			body: JSON.stringify({ value: "example-value" }),
		}),
	);
});

test("does not treat an organization id as a CircleCI context id", async () => {
	const input = context();
	input.connection.auth_config.org_id = "legacy-org";
	const fetch = stubFetch(201);

	expect(await EnterpriseProviderSyncService.sync(input)).toEqual({
		written_count: 1,
		target: { project: "gh/team/repo", context: null },
	});
	expect(fetch).toHaveBeenCalledWith(
		"https://circleci.com/api/v2/project/gh%2Fteam%2Frepo/envvar",
		expect.objectContaining({ method: "POST" }),
	);
});

test("propagates a failed CircleCI context write", async () => {
	const input = context();
	input.mapping.metadata.context_id = "context-1";
	const fetch = stubFetch(404);
	await expect(EnterpriseProviderSyncService.sync(input)).rejects.toMatchObject({
		code: "ENTERPRISE_PROVIDER_SYNC_FAILED",
	});
	expect(fetch).toHaveBeenCalledTimes(1);
});

test("writes project variables when no context is provided and resolves token references", async () => {
	const input = context();
	input.connection.auth_config = { api_token_secret_ref: "circleci-token" };
	const readSecret = spyOn(EnterpriseIntegrationService, "readOrgSecretValue").mockResolvedValue("resolved-token");
	restores.push(() => readSecret.mockRestore());
	const fetch = stubFetch(201);

	expect(await EnterpriseProviderSyncService.sync(input)).toEqual({
		written_count: 1,
		target: { project: "gh/team/repo", context: null },
	});
	expect(readSecret).toHaveBeenCalledWith(input.org_id, "circleci-token");
	expect(fetch).toHaveBeenCalledTimes(1);
	expect(fetch).toHaveBeenCalledWith(
		"https://circleci.com/api/v2/project/gh%2Fteam%2Frepo/envvar",
		expect.objectContaining({
			method: "POST",
			headers: { "Circle-Token": "resolved-token", "Content-Type": "application/json" },
			body: JSON.stringify({ name: "SERVICE_APP_URL", value: "example-value" }),
		}),
	);
});

test("rejects a missing CircleCI destination before sending any requests", async () => {
	const input = context();
	input.mapping.target_identifier = "";
	const fetch = stubFetch();
	await expect(EnterpriseProviderSyncService.sync(input)).rejects.toMatchObject({
		code: "ENTERPRISE_CIRCLECI_TARGET_MISSING",
	});
	expect(fetch).not.toHaveBeenCalled();
});

test("propagates a failed CircleCI project write", async () => {
	const fetch = stubFetch(404);
	await expect(EnterpriseProviderSyncService.sync(context())).rejects.toMatchObject({
		code: "ENTERPRISE_PROVIDER_SYNC_FAILED",
	});
	expect(fetch).toHaveBeenCalledTimes(1);
});
