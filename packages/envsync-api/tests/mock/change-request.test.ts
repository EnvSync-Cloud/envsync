import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { ChangeRequestService } from "@/services/change_request.service";
import {
	seedApp,
	seedEnvType,
	seedOrg,
	seedUser,
	type SeedOrgResult,
} from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

let seed: SeedOrgResult;
let requester: { id: string };
let reviewer: { id: string };
let appId: string;
let otherAppId: string;
let productionEnvTypeId: string;

beforeAll(async () => {
	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});

	requester = await seedUser(seed.org.id, seed.roles.developer.id);
	setupUserOrgTuples(requester.id, seed.org.id, { can_view: true, can_edit: true });

	reviewer = await seedUser(seed.org.id, seed.roles.admin.id);
	setupUserOrgTuples(reviewer.id, seed.org.id, { is_admin: true, can_view: true, can_edit: true });

	const app = await seedApp(seed.org.id);
	appId = app.id;
	const otherApp = await seedApp(seed.org.id, { name: "Other App" });
	otherAppId = otherApp.id;

	const production = await seedEnvType(seed.org.id, appId, { name: "production", isProtected: true });
	productionEnvTypeId = production.id;

	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${productionEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${productionEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${otherAppId}` },
	]);
});

afterEach(() => {
	resetVaultStore();
});

async function createDirect(name: string, targetAppId = appId, envTypeId = productionEnvTypeId) {
	return ChangeRequestService.createDirect({
		org_id: seed.org.id,
		app_id: targetAppId,
		target_env_type_id: envTypeId,
		requested_by_user_id: requester.id,
		title: name,
		message: name,
		envs: [{ key: `API_HOST_${name}`, operation: "CREATE", proposed_value: "https://example.test" }],
	});
}

describe("change request list filter", () => {
	test("listChangeRequests(?app_id=) returns only that project", async () => {
		const thisApp = await createDirect("this-app");
		const otherEnv = await seedEnvType(seed.org.id, otherAppId, {
			name: "production-other",
			isProtected: true,
		});
		await MockFGAClient.writeTuples([
			{ user: `app:${otherAppId}`, relation: "app", object: `env_type:${otherEnv.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${otherEnv.id}` },
		]);
		await createDirect("other-app", otherAppId, otherEnv.id);

		const filtered = await ChangeRequestService.listChangeRequests(seed.org.id, undefined, appId);
		expect(filtered.every(row => row.app_id === appId)).toBe(true);
		expect(filtered.some(row => row.id === thisApp.id)).toBe(true);
	});
});

describe("change request compare-and-swap", () => {
	test("viewer cannot approve a pending request", async () => {
		const created = await createDirect("viewer-approve");
		const viewer = await seedUser(seed.org.id, seed.roles.viewer.id);
		setupUserOrgTuples(viewer.id, seed.org.id, { can_view: true });
		await expect(
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: viewer.id,
			}),
		).rejects.toThrow("permission to approve");
	});

	test("requester cannot approve their own request", async () => {
		const created = await createDirect("self-approve");
		await expect(
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: requester.id,
			}),
		).rejects.toThrow("Requesters cannot approve");
	});

	test("concurrent approve allows only one winner", async () => {
		const created = await createDirect("concurrent-approve");
		const results = await Promise.allSettled([
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: seed.masterUser.id,
			}),
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: reviewer.id,
			}),
		]);
		const fulfilled = results.filter(result => result.status === "fulfilled");
		const rejected = results.filter(result => result.status === "rejected");
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);

		const fetched = await ChangeRequestService.getChangeRequest(created.id, seed.org.id);
		expect(fetched.status).toBe("approved");
		expect(fetched.reviewed_by_user_id).toBeTruthy();
	});

	test("reject and cancel cannot steal a claimed approve", async () => {
		const created = await createDirect("claim-then-reject");
		const db = await (await import("@/libs/db")).DB.getInstance();
		await db
			.updateTable("change_request")
			.set({
				status: "applying",
				reviewed_by_user_id: seed.masterUser.id,
				reviewed_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", created.id)
			.execute();

		await expect(
			ChangeRequestService.rejectChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: reviewer.id,
				rejection_reason: "too late",
			}),
		).rejects.toThrow("Only pending requests can be reviewed");

		await expect(
			ChangeRequestService.cancelChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				requester_user_id: requester.id,
			}),
		).rejects.toThrow("Only pending requests can be cancelled");
	});

	test("failed apply can be retried by any authorized reviewer", async () => {
		const created = await createDirect("retry-failed");
		const db = await (await import("@/libs/db")).DB.getInstance();
		await db
			.updateTable("change_request")
			.set({
				status: "failed",
				reviewed_by_user_id: seed.masterUser.id,
				reviewed_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", created.id)
			.execute();

		const retried = await ChangeRequestService.approveChangeRequest({
			id: created.id,
			org_id: seed.org.id,
			reviewer_user_id: reviewer.id,
		});
		expect(retried.status).toBe("approved");
		expect(retried.reviewed_by_user_id).toBe(reviewer.id);
	});

	test("applying cannot be reclaimed", async () => {
		const created = await createDirect("applying-lock");
		const db = await (await import("@/libs/db")).DB.getInstance();
		await db
			.updateTable("change_request")
			.set({
				status: "applying",
				reviewed_by_user_id: seed.masterUser.id,
				reviewed_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", created.id)
			.execute();

		await expect(
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: seed.masterUser.id,
			}),
		).rejects.toThrow("Only pending or failed requests can be approved");
	});

	test("CREATE env that collides with an existing secret stays failed", async () => {
		const { SecretService } = await import("@/services/secret.service");
		const key = `COLLIDE_${crypto.randomUUID().slice(0, 8)}`;
		await SecretService.createSecret(
			{
				key,
				value: "already-a-secret",
				app_id: appId,
				org_id: seed.org.id,
				env_type_id: productionEnvTypeId,
				user_id: seed.masterUser.id,
			},
			{ allowProtected: true },
		);

		const created = await ChangeRequestService.createDirect({
			org_id: seed.org.id,
			app_id: appId,
			target_env_type_id: productionEnvTypeId,
			requested_by_user_id: requester.id,
			title: "cross-type-create",
			message: "cross-type-create",
			envs: [{ key, operation: "CREATE", proposed_value: "https://example.test" }],
		});

		await expect(
			ChangeRequestService.approveChangeRequest({
				id: created.id,
				org_id: seed.org.id,
				reviewer_user_id: seed.masterUser.id,
			}),
		).rejects.toThrow(/already exists as a secret/i);

		const failed = await ChangeRequestService.getChangeRequest(created.id, seed.org.id);
		expect(failed.status).toBe("failed");
	});

	test("apply throw marks the request failed", async () => {
		const { EnvService } = await import("@/services/env.service");
		const created = await createDirect("apply-throw");
		const original = EnvService.createEnv;
		let calls = 0;
		EnvService.createEnv = (async (...args: Parameters<typeof original>) => {
			calls += 1;
			if (calls === 1) {
				throw new Error("simulated apply crash");
			}
			return original(...args);
		}) as typeof original;

		try {
			await expect(
				ChangeRequestService.approveChangeRequest({
					id: created.id,
					org_id: seed.org.id,
					reviewer_user_id: seed.masterUser.id,
				}),
			).rejects.toThrow("simulated apply crash");
		} finally {
			EnvService.createEnv = original;
		}

		const failed = await ChangeRequestService.getChangeRequest(created.id, seed.org.id);
		expect(failed.status).toBe("failed");
		expect(failed.reviewed_by_user_id).toBe(seed.masterUser.id);

		const retried = await ChangeRequestService.approveChangeRequest({
			id: created.id,
			org_id: seed.org.id,
			reviewer_user_id: seed.masterUser.id,
		});
		expect(retried.status).toBe("approved");
	});
});
