import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, test } from "bun:test";

import { DB } from "@/libs/db";
import { ENV_PIT_SEALED_PREFIX } from "@/helpers/env-pit-value";

import { testRequest } from "../helpers/request";
import { seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

const CREATED_VALUE = "pit-plain-DEV130-create-value";
const UPDATED_VALUE = "pit-plain-DEV130-update-value";
const LEGACY_VALUE = "legacy-plaintext-DEV132-keep";

let seed: SeedOrgResult;
let appId: string;
let envTypeId: string;
let legacyPitId: string;

beforeAll(async () => {
	resetVaultStore();
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

	const app = await seedApp(seed.org.id, { name: "PiT plaintext app" });
	appId = app.id;
	const envType = await seedEnvType(seed.org.id, appId, { name: "pit-plaintext" });
	envTypeId = envType.id;

	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
	]);

	const db = await DB.getInstance();
	legacyPitId = randomUUID();
	const legacyAt = new Date("2020-01-01T00:00:00.000Z");
	await db
		.insertInto("env_store_pit")
		.values({
			id: legacyPitId,
			org_id: seed.org.id,
			app_id: appId,
			env_type_id: envTypeId,
			user_id: seed.masterUser.id,
			change_request_message: "Historical row left untouched",
			created_at: legacyAt,
			updated_at: legacyAt,
		})
		.execute();
	await db
		.insertInto("env_store_pit_change_request")
		.values({
			id: randomUUID(),
			env_store_pit_id: legacyPitId,
			key: "LEGACY_KEY",
			value: LEGACY_VALUE,
			operation: "CREATE",
			created_at: legacyAt,
			updated_at: legacyAt,
		})
		.execute();
});

describe("env point-in-time plaintext", () => {
	test("create and update do not store the env value in the PiT row or message", async () => {
		const created = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "PIT_SECRET",
				value: CREATED_VALUE,
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(created.status).toBe(201);

		const updated = await testRequest("/api/env/i/PIT_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				value: UPDATED_VALUE,
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(updated.status).toBe(200);

		const db = await DB.getInstance();
		const pits = await db
			.selectFrom("env_store_pit")
			.selectAll()
			.where("env_type_id", "=", envTypeId)
			.where("id", "!=", legacyPitId)
			.execute();
		expect(pits.length).toBeGreaterThanOrEqual(2);

		const changes = await db
			.selectFrom("env_store_pit_change_request")
			.selectAll()
			.where(
				"env_store_pit_id",
				"in",
				pits.map(pit => pit.id),
			)
			.where("key", "=", "PIT_SECRET")
			.execute();
		expect(changes.length).toBe(2);

		for (const pit of pits) {
			expect(pit.change_request_message).not.toContain(CREATED_VALUE);
			expect(pit.change_request_message).not.toContain(UPDATED_VALUE);
			expect(pit.change_request_message.includes("→")).toBe(false);
		}
		for (const change of changes) {
			expect(change.value.startsWith(ENV_PIT_SEALED_PREFIX)).toBe(true);
			expect(change.value).not.toContain(CREATED_VALUE);
			expect(change.value).not.toContain(UPDATED_VALUE);
		}

		const updatePit = pits.find(pit => pit.change_request_message === "Updated environment variable: PIT_SECRET");
		expect(updatePit).toBeDefined();

		const timelineRes = await testRequest("/api/env/timeline/PIT_SECRET", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId, key: "PIT_SECRET" },
		});
		expect(timelineRes.status).toBe(200);
		const timeline = await timelineRes.json<Array<{ value: string; operation: string }>>();
		expect(timeline.map(entry => entry.value).sort()).toEqual([CREATED_VALUE, UPDATED_VALUE].sort());

		const legacy = await db
			.selectFrom("env_store_pit_change_request")
			.selectAll()
			.where("env_store_pit_id", "=", legacyPitId)
			.executeTakeFirstOrThrow();
		expect(legacy.value).toBe(LEGACY_VALUE);

		const audits = await db
			.selectFrom("audit_log")
			.select(["action", "message", "details"])
			.where("org_id", "=", seed.org.id)
			.where("action", "in", ["env_created", "env_updated"])
			.execute();
		expect(audits.length).toBeGreaterThanOrEqual(2);
		for (const audit of audits) {
			expect(audit.message).not.toContain(CREATED_VALUE);
			expect(audit.message).not.toContain(UPDATED_VALUE);
			expect(audit.details).not.toContain(CREATED_VALUE);
			expect(audit.details).not.toContain(UPDATED_VALUE);
		}
	});
});
