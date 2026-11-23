import { beforeAll, describe, expect, test } from "bun:test";

import { forwardedAuditLine, prepareAuditEmission } from "envsync-analytics";

import { ENV_PIT_SEALED_PREFIX, openEnvPitValues, sealEnvPitValues } from "@/helpers/env-pit-value";
import { generateKeyPair, rsaLayerDecrypt } from "@/helpers/key-store";
import { DB } from "@/libs/db";
import infoLogs, { LOG_REDACTED, LogTypes } from "@/libs/logger";
import { auditAnalyticsProperties } from "@/libs/posthog";
import { ChangeRequestService } from "@/services/change_request.service";
import { openChangeRequestValue, sealChangeRequestValue } from "@/services/change_request_crypto";
import { auditWebhookBody } from "@/services/webhook.service";
import { seedApp, seedEnvType, seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";
import { testRequest } from "../helpers/request";

/**
 * Unique env and secret values. The tilde cannot appear in base64 ciphertext,
 * so a sealed blob fails this test if the plaintext is still present.
 */
const SENTINEL = "envsync-value-sink-sentinel~DEV134";
const SECRET_SENTINEL = "envsync-secret-sink-sentinel~DEV134";

const ORG_ID = "org_value_sink";
const APP_ID = "app_value_sink";
const ENV_TYPE_ID = "env_type_value_sink";
const USER_ID = "user_value_sink";
const KEY = "DATABASE_URL";

/** Run fn and return everything the application logger wrote to stdout. */
async function captureLoggerOutput(fn: () => unknown | Promise<unknown>): Promise<string> {
	const chunks: string[] = [];
	const original = process.stdout.write.bind(process.stdout);
	process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
		chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
		const callback = rest.find(arg => typeof arg === "function") as (() => void) | undefined;
		callback?.();
		return true;
	}) as typeof process.stdout.write;
	try {
		await fn();
	} finally {
		process.stdout.write = original;
	}
	return chunks.join("");
}

/** Log a value-bearing payload through every logger entry point. */
function logValueBearingPayloads(key: string, value: string, generatedBy: string) {
	infoLogs(
		{
			key,
			value,
			old_value: value,
			new_value: value,
			nested: { previous_value: value, proposed_value: value },
			body: JSON.stringify({ key, value, changes: [{ key, value }] }),
		},
		LogTypes.CUSTOMOBJ,
		generatedBy,
	);
	infoLogs(
		`request body ${JSON.stringify({ key, value })} value=${value}`,
		LogTypes.LOGS,
		generatedBy,
	);
	infoLogs(`write failed for ${key}: new_value=${value}`, LogTypes.ERROR, generatedBy);
}

function expectSinksClean(sinks: Record<string, string>, sentinel: string) {
	for (const [sink, serialized] of Object.entries(sinks)) {
		expect(serialized.includes(sentinel) ? sink : "clean").toBe("clean");
	}
}

let seed: SeedOrgResult;
let requester: { id: string };

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
});

describe("value sinks", () => {
	test("written env value is absent from audit, webhook, log forwarding, PostHog, PiT, change-request storage, and logger output", async () => {
		const details = {
			env_id: "env_value_sink",
			key: KEY,
			app_id: APP_ID,
			env_type_id: ENV_TYPE_ID,
			value: SENTINEL,
		};
		const message = `Environment variable ${KEY} created in app ${APP_ID} for environment type ${ENV_TYPE_ID}.`;
		const emission = prepareAuditEmission({
			action: "env_created",
			org_id: ORG_ID,
			user_id: USER_ID,
			message,
			details,
		});
		const webhook = JSON.stringify(
			auditWebhookBody({
				event_type: "env_created",
				org_id: ORG_ID,
				user_id: USER_ID,
				app_id: APP_ID,
				message: JSON.stringify(details),
				org_name: "Value Sink Org",
				app_name: "Value Sink App",
				user_name: "Value Sink User",
				webhook_name: "Value Sink Hook",
				linked_to_entity: "app",
				timestamp: "2026-01-01T00:00:00.000Z",
				url_for_entity_in_question: `https://example.test/projects/${APP_ID}`,
			}),
		);
		const forwarded = forwardedAuditLine({
			action: "env_created",
			org_id: ORG_ID,
			user_id: USER_ID,
			message,
			details,
		});
		const posthog = JSON.stringify(
			auditAnalyticsProperties({
				action: "env_created",
				org_id: ORG_ID,
				user_id: USER_ID,
				details,
			}),
		);

		const pitStored = await sealEnvPitValues(ORG_ID, APP_ID, ENV_TYPE_ID, [
			{ key: KEY, value: SENTINEL, operation: "CREATE" as const },
		]);
		expect(pitStored).toHaveLength(1);
		expect(pitStored[0].key).toBe(KEY);
		expect(pitStored[0].value.startsWith(ENV_PIT_SEALED_PREFIX)).toBe(true);

		const changeRef = {
			orgId: ORG_ID,
			appId: APP_ID,
			changeRequestId: "cr_value_sink",
			itemId: "item_value_sink",
		};
		const changeStored = await sealChangeRequestValue(changeRef, "proposed", SENTINEL);
		expect(changeStored?.startsWith("KMS:v1:")).toBe(true);

		const loggerOutput = await captureLoggerOutput(() =>
			logValueBearingPayloads(KEY, SENTINEL, "value-sinks-env"),
		);
		expect(loggerOutput).toContain("value-sinks-env");
		expect(loggerOutput).toContain(KEY);
		expect(loggerOutput).toContain(LOG_REDACTED);

		const sinks: Record<string, string> = {
			auditDetails: emission.detailsJson,
			auditWebhookMessage: emission.webhookMessage,
			webhookPayload: webhook,
			logForwardingPayload: forwarded,
			posthogCapture: posthog,
			pitStorage: pitStored[0].value,
			changeRequestStorage: changeStored ?? "",
			loggerOutput,
		};
		expectSinksClean(sinks, SENTINEL);

		const pitOpened = await openEnvPitValues(ORG_ID, APP_ID, ENV_TYPE_ID, pitStored);
		expect(pitOpened[0].value).toBe(SENTINEL);
		const changeOpened = await openChangeRequestValue(changeRef, "proposed", changeStored);
		expect(changeOpened).toBe(SENTINEL);

		expect(emission.detailsJson).toContain(KEY);
		expect(emission.detailsJson).toContain(APP_ID);
		expect(emission.detailsJson).not.toContain('"value"');
		expect(webhook).toContain(KEY);
		expect(webhook).toContain("env_created");
		expect(forwarded).toContain(KEY);
		expect(forwarded).toContain(USER_ID);
		expect(forwarded).toContain("env_created");
		expect(posthog).toContain(KEY);
		expect(posthog).toContain("env_created");
		expect(posthog).not.toContain('"value"');
	});

	test("written secret value is absent from audit, webhook, log forwarding, PostHog, PiT, change-request storage, and logger output", async () => {
		const { publicKey, privateKey } = generateKeyPair();
		const app = await seedApp(seed.org.id, {
			name: "Value Sink Secret App",
			enableSecrets: true,
			publicKey,
			privateKey,
		});
		const envType = await seedEnvType(seed.org.id, app.id, { name: "value-sink-secrets" });
		const protectedEnv = await seedEnvType(seed.org.id, app.id, {
			name: "value-sink-protected",
			isProtected: true,
			isDefault: false,
		});
		await MockFGAClient.writeTuples([
			{ user: `app:${app.id}`, relation: "app", object: `env_type:${envType.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envType.id}` },
			{ user: `app:${app.id}`, relation: "app", object: `env_type:${protectedEnv.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${protectedEnv.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `app:${app.id}` },
		]);
		const secretKey = `VALUE_SINK_SECRET_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
		const db = await DB.getInstance();
		const auditBefore = await db
			.selectFrom("audit_log")
			.select("id")
			.where("org_id", "=", seed.org.id)
			.execute();
		const auditIdsBefore = new Set(auditBefore.map(row => row.id));

		let changeRequestId = "";
		const loggerOutput = await captureLoggerOutput(async () => {
			const res = await testRequest("/api/secret/single", {
				method: "PUT",
				token: seed.masterUser.token,
				body: {
					key: secretKey,
					value: SECRET_SENTINEL,
					app_id: app.id,
					env_type_id: envType.id,
				},
			});
			expect(res.status).toBe(201);

			const created = await ChangeRequestService.createDirect({
				org_id: seed.org.id,
				app_id: app.id,
				target_env_type_id: protectedEnv.id,
				requested_by_user_id: requester.id,
				title: "Value sink secret",
				message: "Secret value stays out of every sink",
				secrets: [{ key: secretKey, operation: "CREATE", proposed_value: SECRET_SENTINEL }],
			});
			changeRequestId = created.id;
			expect(JSON.stringify(created.secret_items)).not.toContain(SECRET_SENTINEL);

			logValueBearingPayloads(secretKey, SECRET_SENTINEL, "value-sinks-secret");
		});
		expect(loggerOutput).toContain("value-sinks-secret");
		expect(loggerOutput).toContain(secretKey);
		expect(loggerOutput).toContain(LOG_REDACTED);

		const auditRows = (
			await db
				.selectFrom("audit_log")
				.select(["id", "action", "details", "message"])
				.where("org_id", "=", seed.org.id)
				.execute()
		).filter(row => !auditIdsBefore.has(row.id));
		const secretAudit = auditRows.find(row => row.action === "secret_created");
		expect(secretAudit).toBeDefined();
		expect(secretAudit!.details).toContain(secretKey);

		const pitRows = await db
			.selectFrom("secret_store_pit_change_request")
			.innerJoin(
				"secret_store_pit",
				"secret_store_pit.id",
				"secret_store_pit_change_request.secret_store_pit_id",
			)
			.select([
				"secret_store_pit_change_request.key",
				"secret_store_pit_change_request.value",
				"secret_store_pit.change_request_message",
			])
			.where("secret_store_pit.app_id", "=", app.id)
			.execute();
		const pitRow = pitRows.find(row => row.key === secretKey);
		expect(pitRow).toBeDefined();
		expect(rsaLayerDecrypt(pitRow!.value, privateKey)).toBe(SECRET_SENTINEL);

		const changeRows = await db
			.selectFrom("change_request_secret_item")
			.selectAll()
			.where("change_request_id", "=", changeRequestId)
			.execute();
		expect(changeRows).toHaveLength(1);
		expect(changeRows[0].proposed_value?.startsWith("KMS:v1:")).toBe(true);

		// Downstream sinks, fed the stored audit row plus a reintroduced value field.
		const details = {
			...(JSON.parse(secretAudit!.details) as Record<string, unknown>),
			value: SECRET_SENTINEL,
			new_value: SECRET_SENTINEL,
		};
		const emission = prepareAuditEmission({
			action: "secret_created",
			org_id: seed.org.id,
			user_id: seed.masterUser.id,
			message: secretAudit!.message,
			details,
		});
		const webhook = JSON.stringify(
			auditWebhookBody({
				event_type: "secret_created",
				org_id: seed.org.id,
				user_id: seed.masterUser.id,
				app_id: app.id,
				message: JSON.stringify(details),
				org_name: "Value Sink Org",
				app_name: app.name,
				user_name: "Value Sink User",
				webhook_name: "Value Sink Hook",
				linked_to_entity: "app",
				timestamp: "2026-01-01T00:00:00.000Z",
				url_for_entity_in_question: `https://example.test/projects/${app.id}`,
			}),
		);
		const forwarded = forwardedAuditLine({
			action: "secret_created",
			org_id: seed.org.id,
			user_id: seed.masterUser.id,
			message: secretAudit!.message,
			details,
		});
		const posthog = JSON.stringify(
			auditAnalyticsProperties({
				action: "secret_created",
				org_id: seed.org.id,
				user_id: seed.masterUser.id,
				details,
			}),
		);

		const sinks: Record<string, string> = {
			auditRows: JSON.stringify(auditRows),
			auditDetails: emission.detailsJson,
			auditWebhookMessage: emission.webhookMessage,
			webhookPayload: webhook,
			logForwardingPayload: forwarded,
			posthogCapture: posthog,
			pitStorage: JSON.stringify(pitRows),
			changeRequestStorage: JSON.stringify(changeRows),
			loggerOutput,
		};
		expectSinksClean(sinks, SECRET_SENTINEL);

		expect(webhook).toContain(secretKey);
		expect(forwarded).toContain(secretKey);
		expect(posthog).toContain("secret_created");
		expect(posthog).not.toContain('"value"');
	});
});
