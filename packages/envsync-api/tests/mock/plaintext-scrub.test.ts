import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, test } from "bun:test";

import { openEnvPitValues, ENV_PIT_SEALED_PREFIX, sealEnvPitValues } from "@/helpers/env-pit-value";
import { openChangeRequestValue } from "@/services/change_request_crypto";
import { AUDIT_GENESIS_HASH, computeAuditEntryHash } from "@/services/audit_log.service";
import {
	PlaintextScrubService,
	scrubAuditDetails,
	scrubHistoryMessage,
} from "@/services/plaintext-scrub.service";
import { DB } from "@/libs/db";

import { seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";

const LEGACY_VALUE = "legacy-plaintext-DEV132-value";
const NEXT_VALUE = "legacy-plaintext-DEV132-next";
const AUDIT_OLD = "audit-old-DEV132-value";
const AUDIT_NEW = "audit-new-DEV132-value";

describe("scrubHistoryMessage", () => {
	test("keeps the variable name and drops embedded values", () => {
		expect(
			scrubHistoryMessage(`Updated environment variable: FOO (${LEGACY_VALUE} → ${NEXT_VALUE})`),
		).toBe("Updated environment variable: FOO");
		expect(scrubHistoryMessage(`Deleted environment variable: FOO (value: ${LEGACY_VALUE})`)).toBe(
			"Deleted environment variable: FOO",
		);
		expect(
			scrubHistoryMessage(
				`Rollback variable FOO to 2020-01-01T00:00:00.000Z: ${LEGACY_VALUE} → ${NEXT_VALUE}`,
			),
		).toBe("Rollback variable FOO to 2020-01-01T00:00:00.000Z");
		expect(
			scrubHistoryMessage(
				`Batch updated 2 environment variables: FOO: ${LEGACY_VALUE} → ${NEXT_VALUE}, BAR: ${AUDIT_OLD} → ${AUDIT_NEW}`,
			),
		).toBe("Batch updated 2 environment variables: FOO, BAR");
		expect(scrubHistoryMessage("Created environment variable: FOO")).toBe(
			"Created environment variable: FOO",
		);
	});
});

describe("scrubAuditDetails", () => {
	test("removes value fields and leaves other metadata", () => {
		const original = JSON.stringify({
			key: "FOO",
			app_id: "app",
			old_value: AUDIT_OLD,
			new_value: AUDIT_NEW,
		});
		const scrubbed = scrubAuditDetails(original);
		expect(scrubbed.changed).toBe(true);
		expect(scrubbed.next).not.toContain(AUDIT_OLD);
		expect(scrubbed.next).not.toContain(AUDIT_NEW);
		expect(JSON.parse(scrubbed.next)).toEqual({ key: "FOO", app_id: "app" });
		expect(scrubAuditDetails(scrubbed.next).changed).toBe(false);
	});
});

describe("stored plaintext scrub", () => {
	let seed: SeedOrgResult;
	let appId: string;
	let envTypeId: string;

	beforeAll(async () => {
		seed = await seedOrg();
		const app = await seedApp(seed.org.id, { name: "Scrub app" });
		appId = app.id;
		const envType = await seedEnvType(seed.org.id, appId, { name: "scrub" });
		envTypeId = envType.id;
	});

	test("seals legacy rows and drops values from history messages and audit details", async () => {
		const db = await DB.getInstance();
		const now = new Date("2024-06-01T00:00:00.000Z");
		const later = new Date("2024-06-01T00:00:01.000Z");
		const pitId = randomUUID();
		const sealedPitId = randomUUID();
		const changeRequestId = randomUUID();
		const envItemId = randomUUID();
		const secretItemId = randomUUID();
		const auditId = randomUUID();
		const laterAuditId = randomUUID();

		const sealed = await sealEnvPitValues(seed.org.id, appId, envTypeId, [
			{ key: "ALREADY", value: "already-sealed" },
		]);

		await db
			.insertInto("env_store_pit")
			.values([
				{
					id: pitId,
					org_id: seed.org.id,
					app_id: appId,
					env_type_id: envTypeId,
					user_id: seed.masterUser.id,
					change_request_message: `Updated environment variable: LEGACY (${LEGACY_VALUE} → ${NEXT_VALUE})`,
					created_at: now,
					updated_at: now,
				},
				{
					id: sealedPitId,
					org_id: seed.org.id,
					app_id: appId,
					env_type_id: envTypeId,
					user_id: seed.masterUser.id,
					change_request_message: "Created environment variable: ALREADY",
					created_at: now,
					updated_at: now,
				},
			])
			.execute();
		await db
			.insertInto("env_store_pit_change_request")
			.values([
				{
					id: randomUUID(),
					env_store_pit_id: pitId,
					key: "LEGACY",
					value: LEGACY_VALUE,
					operation: "UPDATE",
					created_at: now,
					updated_at: now,
				},
				{
					id: randomUUID(),
					env_store_pit_id: sealedPitId,
					key: "ALREADY",
					value: sealed[0].value,
					operation: "CREATE",
					created_at: now,
					updated_at: now,
				},
			])
			.execute();

		await db
			.insertInto("change_request")
			.values({
				id: changeRequestId,
				org_id: seed.org.id,
				app_id: appId,
				request_kind: "direct",
				target_env_type_id: envTypeId,
				status: "approved",
				title: "Legacy",
				message: "Legacy change",
				requested_by_user_id: seed.masterUser.id,
				created_at: now,
				updated_at: now,
			})
			.execute();
		await db
			.insertInto("change_request_env_item")
			.values({
				id: envItemId,
				change_request_id: changeRequestId,
				key: "LEGACY",
				previous_value: null,
				proposed_value: LEGACY_VALUE,
				operation: "CREATE",
				created_at: now,
				updated_at: now,
			})
			.execute();
		await db
			.insertInto("change_request_secret_item")
			.values({
				id: secretItemId,
				change_request_id: changeRequestId,
				key: "LEGACY_SECRET",
				previous_value: LEGACY_VALUE,
				proposed_value: null,
				operation: "DELETE",
				created_at: now,
				updated_at: now,
			})
			.execute();

		const dirtyDetails = JSON.stringify({
			key: "LEGACY",
			app_id: appId,
			old_value: AUDIT_OLD,
			new_value: AUDIT_NEW,
		});
		const cleanDetails = JSON.stringify({ key: "LATER", app_id: appId });
		const firstHash = computeAuditEntryHash(
			AUDIT_GENESIS_HASH,
			now.toISOString(),
			"env_updated",
			seed.org.id,
			seed.masterUser.id,
			dirtyDetails,
		);
		const secondHash = computeAuditEntryHash(
			firstHash,
			later.toISOString(),
			"env_updated",
			seed.org.id,
			seed.masterUser.id,
			cleanDetails,
		);
		await db
			.insertInto("audit_log")
			.values([
				{
					id: auditId,
					org_id: seed.org.id,
					user_id: seed.masterUser.id,
					action: "env_updated",
					details: dirtyDetails,
					message: `Environment variable LEGACY updated (${AUDIT_OLD} → ${AUDIT_NEW})`,
					previous_hash: AUDIT_GENESIS_HASH,
					entry_hash: firstHash,
					created_at: now,
					updated_at: now,
				},
				{
					id: laterAuditId,
					org_id: seed.org.id,
					user_id: seed.masterUser.id,
					action: "env_updated",
					details: cleanDetails,
					message: "Environment variable LATER updated",
					previous_hash: firstHash,
					entry_hash: secondHash,
					created_at: later,
					updated_at: later,
				},
			])
			.execute();

		const report = await PlaintextScrubService.run({ orgId: seed.org.id });
		expect(report.failed).toBe(0);
		expect(report.env_pit_values).toBeGreaterThanOrEqual(1);
		expect(report.env_pit_messages).toBeGreaterThanOrEqual(1);
		expect(report.change_request_env_values).toBeGreaterThanOrEqual(1);
		expect(report.change_request_secret_values).toBeGreaterThanOrEqual(1);
		expect(report.audit_details).toBeGreaterThanOrEqual(1);
		expect(report.audit_rehashed).toBeGreaterThanOrEqual(1);

		const legacy = await db
			.selectFrom("env_store_pit_change_request")
			.selectAll()
			.where("env_store_pit_id", "=", pitId)
			.executeTakeFirstOrThrow();
		expect(legacy.value.startsWith(ENV_PIT_SEALED_PREFIX)).toBe(true);
		expect(legacy.value).not.toContain(LEGACY_VALUE);
		const opened = await openEnvPitValues(seed.org.id, appId, envTypeId, [legacy]);
		expect(opened[0].value).toBe(LEGACY_VALUE);

		const kept = await db
			.selectFrom("env_store_pit_change_request")
			.select("value")
			.where("env_store_pit_id", "=", sealedPitId)
			.executeTakeFirstOrThrow();
		expect(kept.value).toBe(sealed[0].value);

		const pit = await db
			.selectFrom("env_store_pit")
			.select("change_request_message")
			.where("id", "=", pitId)
			.executeTakeFirstOrThrow();
		expect(pit.change_request_message).toBe("Updated environment variable: LEGACY");
		expect(pit.change_request_message).not.toContain(LEGACY_VALUE);

		const envItem = await db
			.selectFrom("change_request_env_item")
			.selectAll()
			.where("id", "=", envItemId)
			.executeTakeFirstOrThrow();
		expect(envItem.proposed_value?.startsWith("KMS:v1:")).toBe(true);
		expect(envItem.proposed_value).not.toContain(LEGACY_VALUE);
		expect(
			await openChangeRequestValue(
				{ orgId: seed.org.id, appId, changeRequestId, itemId: envItemId },
				"proposed",
				envItem.proposed_value,
			),
		).toBe(LEGACY_VALUE);

		const secretItem = await db
			.selectFrom("change_request_secret_item")
			.selectAll()
			.where("id", "=", secretItemId)
			.executeTakeFirstOrThrow();
		expect(secretItem.previous_value?.startsWith("KMS:v1:")).toBe(true);
		expect(secretItem.previous_value).not.toContain(LEGACY_VALUE);

		const audits = await db
			.selectFrom("audit_log")
			.selectAll()
			.where("org_id", "=", seed.org.id)
			.orderBy("created_at", "asc")
			.execute();
		expect(audits[0].details).not.toContain(AUDIT_OLD);
		expect(audits[0].details).not.toContain(AUDIT_NEW);
		expect(audits[0].message).not.toContain(AUDIT_OLD);
		expect(audits[0].message).not.toContain(AUDIT_NEW);
		expect(audits[1].details).toBe(cleanDetails);

		let previous = AUDIT_GENESIS_HASH;
		for (const row of audits) {
			expect(row.previous_hash).toBe(previous);
			const hash = computeAuditEntryHash(
				previous,
				new Date(row.created_at).toISOString(),
				row.action,
				row.org_id,
				row.user_id,
				row.details,
			);
			expect(row.entry_hash).toBe(hash);
			previous = hash;
		}

		const again = await PlaintextScrubService.run({ orgId: seed.org.id });
		expect(again.env_pit_values).toBe(0);
		expect(again.change_request_env_values).toBe(0);
		expect(again.change_request_secret_values).toBe(0);
		expect(again.audit_details).toBe(0);
		expect(again.failed).toBe(0);
	});
});
