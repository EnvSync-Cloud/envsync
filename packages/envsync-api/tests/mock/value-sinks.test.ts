import { describe, expect, test } from "bun:test";

import { forwardedAuditLine, prepareAuditEmission } from "envsync-analytics";

import { ENV_PIT_SEALED_PREFIX, openEnvPitValues, sealEnvPitValues } from "@/helpers/env-pit-value";
import { auditAnalyticsProperties } from "@/libs/posthog";
import { openChangeRequestValue, sealChangeRequestValue } from "@/services/change_request_crypto";
import { auditWebhookBody } from "@/services/webhook.service";

/**
 * Unique env value. The tilde cannot appear in base64 ciphertext, so a sealed
 * blob fails this test if the plaintext is still present.
 * Application logs are not asserted: the logger has no exported redact helper.
 */
const SENTINEL = "envsync-value-sink-sentinel~DEV134";

const ORG_ID = "org_value_sink";
const APP_ID = "app_value_sink";
const ENV_TYPE_ID = "env_type_value_sink";
const USER_ID = "user_value_sink";
const KEY = "DATABASE_URL";

describe("value sinks", () => {
	test("written env value is absent from audit, webhook, log forwarding, PostHog, PiT, and change-request storage", async () => {
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

		const sinks: Record<string, string> = {
			auditDetails: emission.detailsJson,
			auditWebhookMessage: emission.webhookMessage,
			webhookPayload: webhook,
			logForwardingPayload: forwarded,
			posthogCapture: posthog,
			pitStorage: pitStored[0].value,
			changeRequestStorage: changeStored ?? "",
		};
		for (const [sink, serialized] of Object.entries(sinks)) {
			expect(serialized.includes(SENTINEL) ? sink : "clean").toBe("clean");
		}

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
});
