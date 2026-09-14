import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	checkServiceHealth,
	type E2ESeed,
	seedE2EOrg,
	seedE2EUser,
	setupE2EUserPermissions,
} from "../helpers/real-auth";

let seed: E2ESeed;
let requesterUser: { id: string; token: string };
let appId: string;
let stagingEnvTypeId: string;
let productionEnvTypeId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	requesterUser = await seedE2EUser(seed.org.id, seed.roles.developer.id);
	await setupE2EUserPermissions(requesterUser.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});

	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "E2E Change Request App",
			description: "Protected env approval tests",
			enable_secrets: true,
		},
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	const stagingRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "staging", app_id: appId },
	});
	expect(stagingRes.status).toBe(201);
	stagingEnvTypeId = (await stagingRes.json<{ id: string }>()).id;

	const productionRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "production", app_id: appId, is_protected: true },
	});
	expect(productionRes.status).toBe(201);
	productionEnvTypeId = (await productionRes.json<{ id: string }>()).id;
});

describe("Change Request E2E", () => {
	test("protected env direct mutation returns request-required error", async () => {
		const res = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: productionEnvTypeId,
				key: "API_HOST",
				value: "https://prod.envsync.local",
			},
		});

		expect(res.status).toBe(409);
		const body = await res.json<{ code: string; error: string }>();
		expect(body.code).toBe("PROTECTED_ENV_REQUIRES_CHANGE_REQUEST");
	});

	test("direct change request can be created, cannot self-approve, and applies on approval", async () => {
		const createRes = await testRequest("/api/change_request/direct", {
			method: "POST",
			token: requesterUser.token,
			body: {
				app_id: appId,
				target_env_type_id: productionEnvTypeId,
				title: "Create prod API host",
				message: "Add production API host after review",
				envs: [
					{
						key: "API_HOST",
						operation: "CREATE",
						proposed_value: "https://prod.envsync.local",
					},
				],
			},
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json<{ id: string; status: string; env_item_count: number }>();
		expect(created.status).toBe("pending");
		expect(created.env_item_count).toBe(1);

		const selfApproveRes = await testRequest(`/api/change_request/${created.id}/approve`, {
			method: "POST",
			token: requesterUser.token,
		});
		expect(selfApproveRes.status).toBe(403);

		const approveRes = await testRequest(`/api/change_request/${created.id}/approve`, {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(approveRes.status).toBe(200);
		const approved = await approveRes.json<{ status: string; reviewed_by_user_id: string | null; applied_at: string | null }>();
		expect(approved.status).toBe("approved");
		expect(approved.reviewed_by_user_id).toBe(seed.masterUser.id);
		expect(approved.applied_at).toBeTruthy();

		const envListRes = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: productionEnvTypeId },
		});
		expect(envListRes.status).toBe(200);
		const envs = await envListRes.json<Array<{ key: string; value: string }>>();
		const apiHost = envs.find((env) => env.key === "API_HOST");
		expect(apiHost?.value).toBe("https://prod.envsync.local");
	});

	test("concurrent approve allows only one winner", async () => {
		const reviewer = await seedE2EUser(seed.org.id, seed.roles.admin.id);
		await setupE2EUserPermissions(reviewer.id, seed.org.id, {
			is_admin: true,
			can_view: true,
			can_edit: true,
		});

		const createRes = await testRequest("/api/change_request/direct", {
			method: "POST",
			token: requesterUser.token,
			body: {
				app_id: appId,
				target_env_type_id: productionEnvTypeId,
				title: "Concurrent approve",
				message: "Only one reviewer should win",
				envs: [
					{
						key: "CONCURRENT_HOST",
						operation: "CREATE",
						proposed_value: "https://once.envsync.local",
					},
				],
			},
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json<{ id: string }>();

		const results = await Promise.allSettled([
			testRequest(`/api/change_request/${created.id}/approve`, {
				method: "POST",
				token: seed.masterUser.token,
			}),
			testRequest(`/api/change_request/${created.id}/approve`, {
				method: "POST",
				token: reviewer.token,
			}),
		]);
		const statuses = await Promise.all(
			results.map(async result => {
				if (result.status !== "fulfilled") return 500;
				return result.value.status;
			}),
		);
		expect(statuses.filter(status => status === 200)).toHaveLength(1);
		expect(statuses.filter(status => status >= 400)).toHaveLength(1);

		const fetched = await testRequest(`/api/change_request/${created.id}`, {
			token: seed.masterUser.token,
		});
		expect(fetched.status).toBe(200);
		expect((await fetched.json<{ status: string }>()).status).toBe("approved");
	});

	test("promotion request snapshots source values before approval", async () => {
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: stagingEnvTypeId,
				key: "PROMOTED_HOST",
				value: "stage-v1.envsync.local",
			},
		});
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: stagingEnvTypeId,
				key: "PROMOTED_SECRET",
				value: "snapshot-secret-v1",
			},
		});

		const requestRes = await testRequest("/api/change_request/promotion", {
			method: "POST",
			token: requesterUser.token,
			body: {
				app_id: appId,
				source_env_type_id: stagingEnvTypeId,
				target_env_type_id: productionEnvTypeId,
				title: "Promote staging snapshot",
				message: "Promote current staging snapshot to prod",
			},
		});
		expect(requestRes.status).toBe(201);
		const request = await requestRes.json<{ id: string; status: string; env_item_count: number; secret_item_count: number }>();
		expect(request.status).toBe("pending");
		expect(request.env_item_count).toBeGreaterThanOrEqual(1);
		expect(request.secret_item_count).toBeGreaterThanOrEqual(1);

		await testRequest("/api/env/i/PROMOTED_HOST", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: stagingEnvTypeId,
				value: "stage-v2.envsync.local",
			},
		});
		await testRequest("/api/secret/i/PROMOTED_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: stagingEnvTypeId,
				value: "snapshot-secret-v2",
			},
		});

		const approveRes = await testRequest(`/api/change_request/${request.id}/approve`, {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(approveRes.status).toBe(200);

		const targetEnvRes = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: productionEnvTypeId },
		});
		expect(targetEnvRes.status).toBe(200);
		const targetEnvs = await targetEnvRes.json<Array<{ key: string; value: string }>>();
		const promotedHost = targetEnvs.find((env) => env.key === "PROMOTED_HOST");
		expect(promotedHost?.value).toBe("stage-v1.envsync.local");

		const targetSecretRes = await testRequest("/api/secret", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: productionEnvTypeId },
		});
		expect(targetSecretRes.status).toBe(200);
		const targetSecrets = await targetSecretRes.json<Array<{ key: string; value: string }>>();
		const promotedSecret = targetSecrets.find((secret) => secret.key === "PROMOTED_SECRET");
		expect(promotedSecret).toBeDefined();
		expect(
			promotedSecret!.value.startsWith("RSA:") || promotedSecret!.value.startsWith("HYB:"),
		).toBe(true);
	});

	test("rejected change request does not mutate target env", async () => {
		const createRes = await testRequest("/api/change_request/direct", {
			method: "POST",
			token: requesterUser.token,
			body: {
				app_id: appId,
				target_env_type_id: productionEnvTypeId,
				title: "Reject this change",
				message: "This should stay pending until rejected",
				envs: [
					{
						key: "REJECTED_ENV",
						operation: "CREATE",
						proposed_value: "never-applied",
					},
				],
			},
		});
		expect(createRes.status).toBe(201);
		const request = await createRes.json<{ id: string }>();

		const rejectRes = await testRequest(`/api/change_request/${request.id}/reject`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { rejection_reason: "No change window" },
		});
		expect(rejectRes.status).toBe(200);
		const rejected = await rejectRes.json<{ status: string; rejection_reason: string | null }>();
		expect(rejected.status).toBe("rejected");
		expect(rejected.rejection_reason).toBe("No change window");

		const envListRes = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: productionEnvTypeId },
		});
		expect(envListRes.status).toBe(200);
		const envs = await envListRes.json<Array<{ key: string }>>();
		expect(envs.some((env) => env.key === "REJECTED_ENV")).toBe(false);
	});
});
