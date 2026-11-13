import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	POSTHOG_BROWSER_INIT,
	forwardedAuditLine,
	prepareAuditEmission,
} from "envsync-analytics";

import { auditAnalyticsProperties } from "@/libs/posthog";
import { auditWebhookBody } from "@/services/webhook.service";

const WRITE_VALUE = "write-sentinel-value";
const UPDATE_OLD = "update-old-sentinel";
const UPDATE_NEW = "update-new-sentinel";
const DELETE_VALUE = "delete-sentinel-value";
const BATCH_VALUE = "batch-delete-sentinel";
const BATCH_OTHER = "batch-other-sentinel";
const ROLLBACK_OLD = "rollback-old-sentinel";
const ROLLBACK_NEW = "rollback-new-sentinel";

type FanoutCase = {
	id: string;
	actions: string[];
	details: Record<string, unknown>;
	forbidden: string[];
	required: string[];
	posthogRequired: string[];
};

const CASES: FanoutCase[] = [
	{
		id: "write",
		actions: ["env_created", "secret_created"],
		details: {
			env_id: "env_1",
			secret_id: "secret_1",
			key: "DATABASE_URL",
			app_id: "app_1",
			env_type_id: "env_type_1",
			value: WRITE_VALUE,
		},
		forbidden: [WRITE_VALUE],
		required: ["DATABASE_URL", "app_1", "env_1"],
		posthogRequired: ["DATABASE_URL", "app_1"],
	},
	{
		id: "update",
		actions: ["env_updated", "secret_updated"],
		details: {
			key: "DATABASE_URL",
			app_id: "app_1",
			env_type_id: "env_type_1",
			old_value: UPDATE_OLD,
			new_value: UPDATE_NEW,
		},
		forbidden: [UPDATE_OLD, UPDATE_NEW],
		required: ["DATABASE_URL", "app_1"],
		posthogRequired: ["DATABASE_URL", "app_1"],
	},
	{
		id: "delete",
		actions: ["env_deleted", "secret_deleted"],
		details: {
			app_id: "app_1",
			env_type_id: "env_type_1",
			key: "DATABASE_URL",
			deleted_value: DELETE_VALUE,
		},
		forbidden: [DELETE_VALUE],
		required: ["DATABASE_URL", "app_1"],
		posthogRequired: ["DATABASE_URL", "app_1"],
	},
	{
		id: "batch-delete",
		actions: ["envs_batch_deleted", "secrets_batch_deleted"],
		details: {
			app_id: "app_1",
			env_type_id: "env_type_1",
			env_count: 2,
			keys: ["DATABASE_URL", "API_TOKEN"],
			deleted_values: [
				{ key: "DATABASE_URL", value: BATCH_VALUE },
				{ key: "API_TOKEN", value: BATCH_OTHER },
			],
		},
		forbidden: [BATCH_VALUE, BATCH_OTHER],
		required: ["DATABASE_URL", "API_TOKEN", "app_1"],
		posthogRequired: ["app_1"],
	},
	{
		id: "rollback",
		actions: ["env_variable_rollback_pit", "secrets_rollback_pit"],
		details: {
			app_id: "app_1",
			env_type_id: "env_type_1",
			key: "DATABASE_URL",
			pit_id: "pit_1",
			operation: "UPDATE",
			previous_value: ROLLBACK_OLD,
			target_value: ROLLBACK_NEW,
			operations: [
				{
					key: "DATABASE_URL",
					value: ROLLBACK_NEW,
					operation: "UPDATE",
					previous_value: ROLLBACK_OLD,
					target_value: ROLLBACK_NEW,
				},
			],
			changes: [`DATABASE_URL: ${ROLLBACK_OLD} → ${ROLLBACK_NEW}`],
		},
		forbidden: [ROLLBACK_OLD, ROLLBACK_NEW],
		required: ["DATABASE_URL", "pit_1", "UPDATE"],
		posthogRequired: ["DATABASE_URL", "pit_1"],
	},
];

function assertAbsent(serialized: string, forbidden: string[]) {
	for (const value of forbidden) {
		expect(serialized).not.toContain(value);
	}
}

function assertPresent(serialized: string, required: string[]) {
	for (const value of required) {
		expect(serialized).toContain(value);
	}
}

describe("audit metadata fan-out", () => {
	for (const fixture of CASES) {
		for (const action of fixture.actions) {
			test(`${fixture.id} ${action} omits variable values from posthog, audit, webhook, and forwarded log`, () => {
				const message = `Environment variable DATABASE_URL ${fixture.id} in app app_1.`;
				const emission = prepareAuditEmission({
					action,
					org_id: "org_1",
					user_id: "user_1",
					message,
					details: fixture.details,
				});
				const posthog = JSON.stringify(
					auditAnalyticsProperties({
						action,
						org_id: "org_1",
						user_id: "user_1",
						details: fixture.details,
					}),
				);
				const webhook = JSON.stringify(
					auditWebhookBody({
						event_type: action as AuditActions,
						org_id: "org_1",
						user_id: "user_1",
						app_id: "app_1",
						message: JSON.stringify(fixture.details),
						org_name: "Org",
						app_name: "App",
						user_name: "User",
						webhook_name: "Hook",
						linked_to_entity: "org",
						timestamp: "2026-01-01T00:00:00.000Z",
						url_for_entity_in_question: "https://example.test/projects/app_1",
					}),
				);
				const forwarded = forwardedAuditLine({
					action,
					org_id: "org_1",
					user_id: "user_1",
					message,
					details: fixture.details,
				});

				assertAbsent(posthog, fixture.forbidden);
				assertAbsent(emission.detailsJson, fixture.forbidden);
				assertAbsent(webhook, fixture.forbidden);
				assertAbsent(emission.webhookMessage, fixture.forbidden);
				assertAbsent(forwarded, fixture.forbidden);
				assertAbsent(emission.forwardedLine, fixture.forbidden);

				assertPresent(posthog, fixture.posthogRequired);
				assertPresent(emission.detailsJson, fixture.required);
				assertPresent(webhook, fixture.required);
				assertPresent(forwarded, fixture.required);
				expect(posthog).toContain(action);
				expect(emission.detailsJson).not.toContain("old_value");
				expect(emission.detailsJson).not.toContain("new_value");
				expect(forwarded).toContain(action);
				expect(forwarded).toContain("user_1");
			});
		}
	}

	const cliSentinel = "cli-sentinel-value";
	const cliCases = [
		{
			id: "cli-equals",
			command: `envsync set KEY=${cliSentinel}`,
			kept: ["envsync", "set", "KEY=<redacted>"],
		},
		{
			id: "cli-positional-set",
			command: `envsync set KEY ${cliSentinel}`,
			kept: ["envsync", "set", "KEY", "<redacted>"],
		},
		{
			id: "cli-import",
			command: `envsync import ${cliSentinel}`,
			kept: ["envsync", "import", "<redacted>"],
		},
		{
			id: "cli-flag-equals",
			command: `envsync push --env=${cliSentinel}`,
			kept: ["envsync", "push", "--env=<redacted>"],
		},
		{
			id: "cli-quoted",
			command: `envsync set KEY "${cliSentinel}"`,
			kept: ["envsync", "set", "KEY", "<redacted>"],
		},
	];

	for (const fixture of cliCases) {
		test(`${fixture.id} omits the typed command value from posthog, audit, webhook, and forwarded log`, () => {
			const message = `Executed CLI command: ${fixture.command}`;
			const details = { command: fixture.command };
			const emission = prepareAuditEmission({
				action: "cli_command_executed",
				org_id: "org_1",
				user_id: "user_1",
				message,
				details,
			});
			const posthog = JSON.stringify(
				auditAnalyticsProperties({
					action: "cli_command_executed",
					org_id: "org_1",
					user_id: "user_1",
					details,
				}),
			);
			const webhook = JSON.stringify(
				auditWebhookBody({
					event_type: "cli_command_executed",
					org_id: "org_1",
					user_id: "user_1",
					message: JSON.stringify(details),
					org_name: "Org",
					app_name: "App",
					user_name: "User",
					webhook_name: "Hook",
					linked_to_entity: "org",
					timestamp: "2026-01-01T00:00:00.000Z",
					url_for_entity_in_question: "https://example.test/org",
				}),
			);
			const forwarded = forwardedAuditLine({
				action: "cli_command_executed",
				org_id: "org_1",
				user_id: "user_1",
				message,
				details,
			});

			for (const serialized of [posthog, emission.detailsJson, emission.message, webhook, forwarded, emission.forwardedLine]) {
				expect(serialized).not.toContain(cliSentinel);
			}
			for (const kept of fixture.kept) {
				expect(emission.detailsJson).toContain(kept);
				expect(emission.message).toContain(kept);
				expect(webhook).toContain(kept);
				expect(forwarded).toContain(kept);
			}
			expect(posthog).toContain("cli_command_executed");
		});
	}

	test("posthog clients disable session recording", () => {
		expect(POSTHOG_BROWSER_INIT.disable_session_recording).toBe(true);
		const root = join(import.meta.dir, "../../../..");
		const sources = [
			"apps/envsync-web/src/telemetry/posthog.ts",
			"apps/envsync-landing/src/telemetry/posthog.ts",
			"packages/envsync-api/src/libs/posthog.ts",
		];
		for (const rel of sources) {
			const source = readFileSync(join(root, rel), "utf8");
			expect(source).toContain("disable_session_recording: true");
		}
		for (const rel of sources.slice(0, 2)) {
			expect(readFileSync(join(root, rel), "utf8")).toContain("POSTHOG_BROWSER_INIT");
		}
	});
});
