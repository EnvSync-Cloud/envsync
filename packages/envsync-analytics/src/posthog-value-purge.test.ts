import { describe, expect, test } from "bun:test";

import { AUDIT_VALUE_FIELD_NAMES } from "./audit-metadata";
import {
	POSTHOG_PURGE_PROPERTY_NAMES,
	deletionReceipt,
	eventCountQuery,
	eventCountWidth,
	eventCountsFromRow,
	eventDeletionQuery,
	isValueBearingPropertyName,
	personUnsetBody,
	planPosthogPurge,
	posthogAppOrigin,
	projectIdsFromList,
	soleProjectId,
	purgeReport,
	readCountRow,
	redactOperatorText,
	valueBearingPropertyNames,
} from "./posthog-value-purge";

const SENTINEL = "posthog-sentinel-value";

describe("value-bearing PostHog properties", () => {
	test("selects value-field names and drops the sentinel", () => {
		const properties: Record<string, unknown> = {
			org_id: SENTINEL,
			key: "DATABASE_URL",
			message: `value: ${SENTINEL}`,
			value_hash: SENTINEL,
			note: SENTINEL,
			Value: SENTINEL,
			$set: { plaintext: SENTINEL, email: "ada@example.test" },
			nested: { new_value: SENTINEL, proposed_value: SENTINEL },
			changes: [{ previous_value: SENTINEL, old_value: SENTINEL, secret: SENTINEL }],
		};
		for (const name of POSTHOG_PURGE_PROPERTY_NAMES) properties[name] = SENTINEL;

		const names = valueBearingPropertyNames(properties);

		expect(names).toEqual([...AUDIT_VALUE_FIELD_NAMES].sort());
		expect(names).not.toContain("org_id");
		expect(names).not.toContain("key");
		expect(names).not.toContain("note");
		expect(names).not.toContain("value_hash");
		expect(names).not.toContain("$set");
		expect(isValueBearingPropertyName("password")).toBe(true);
		expect(isValueBearingPropertyName("org_id")).toBe(false);
		expect(JSON.stringify(names)).not.toContain(SENTINEL);

		const report = purgeReport({
			dryRun: true,
			applied: false,
			events: {
				matched: names.length,
				properties: Object.fromEntries(names.map((name) => [name, 1])),
			},
			persons: { matched: 0, properties: {} },
		});
		expect(JSON.stringify(report)).not.toContain(SENTINEL);
		expect(report.property_names).toEqual([...POSTHOG_PURGE_PROPERTY_NAMES]);
	});

	test("count and deletion queries name keys and do not read values", () => {
		const deletion = eventDeletionQuery();
		expect(deletion.startsWith("SELECT uuid FROM events WHERE ")).toBe(true);
		expect(deletion).not.toContain("IS NOT NULL");
		expect(deletion).not.toContain(SENTINEL);
		expect(deletion).not.toContain(";");
		for (const name of POSTHOG_PURGE_PROPERTY_NAMES) {
			expect(deletion).toContain(`JSONHas(properties, '${name}')`);
			expect(deletion).toContain(`JSONHas(properties, '$set', '${name}')`);
			expect(deletion).toContain(`JSONHas(properties, '$set_once', '${name}')`);
		}
		expect(deletion).not.toContain("person_properties");
		expect(eventCountQuery()).toContain("countIf(");
		expect(eventCountQuery()).not.toContain(SENTINEL);

		const names = POSTHOG_PURGE_PROPERTY_NAMES;
		const row = new Array<number>(eventCountWidth()).fill(0);
		row[0] = 6;
		row[1 + names.indexOf("value")] = 4;
		expect(eventCountsFromRow(row)).toMatchObject({
			matched: 6,
			properties: { value: 4, secret: 0 },
		});
		expect(readCountRow({ results: [[0, SENTINEL]], ignored: SENTINEL }, 2)).toBeNull();
		expect(JSON.stringify(personUnsetBody())).not.toContain(SENTINEL);
	});

	test("does not call the network", () => {
		const original = globalThis.fetch;
		globalThis.fetch = () => {
			throw new Error("network");
		};
		try {
			expect(valueBearingPropertyNames({ value: SENTINEL, org_id: "org_1" })).toEqual(["value"]);
			expect(posthogAppOrigin("https://eu.i.posthog.com")).toBe("https://eu.posthog.com");
		} finally {
			globalThis.fetch = original;
		}
	});
});

describe("PostHog purge plan", () => {
	test("skips when host or key is unset", () => {
		const dry = planPosthogPurge({ POSTHOG_HOST: "https://eu.i.posthog.com" }, { apply: false });
		expect(dry).toEqual({
			run: false,
			message: "PostHog purge was not run (POSTHOG_HOST or POSTHOG_KEY unset).",
			exitCode: 0,
		});
		const apply = planPosthogPurge({ POSTHOG_KEY: "phx_sentinel" }, { apply: true });
		expect(apply.run).toBe(false);
		if (!apply.run) expect(apply.exitCode).toBe(1);
	});

	test("does not call PostHog with a project key or a non-app host", () => {
		const projectKey = planPosthogPurge(
			{ POSTHOG_HOST: "https://eu.i.posthog.com", POSTHOG_KEY: "phc_sentinel" },
			{ apply: false },
		);
		expect(projectKey).toMatchObject({
			run: false,
			message: "PostHog purge was not run (personal API key is not set).",
			exitCode: 0,
		});
		expect(JSON.stringify(projectKey)).not.toContain("phc_sentinel");

		const proxy = planPosthogPurge(
			{ POSTHOG_HOST: "https://t.envsync.cloud/ph", POSTHOG_KEY: "phx_sentinel" },
			{ apply: false },
		);
		expect(proxy.run).toBe(false);
		expect(JSON.stringify(proxy)).not.toContain("phx_sentinel");
		expect(posthogAppOrigin("https://us.i.posthog.com/e")).toBe("https://us.posthog.com");
		expect(posthogAppOrigin("http://eu.posthog.com")).toBeNull();
	});

	test("keeps listed project ids and drops tokens and values", () => {
		const ids = projectIdsFromList({
			results: [{ id: 7, name: "EnvSync", api_token: "phc_sentinel", value: SENTINEL }],
		});
		expect(ids).toEqual([7]);
		expect(
			soleProjectId({
				results: [{ id: 7, api_token: "phc_sentinel", value: SENTINEL }],
				count: 1,
				next: null,
			}),
		).toBe(7);
		expect(
			soleProjectId({
				results: [{ id: 7 }, { id: 8 }],
				count: 2,
				next: "https://eu.posthog.com/api/projects/?offset=1",
			}),
		).toBeNull();
		expect(JSON.stringify(ids)).not.toContain(SENTINEL);
		expect(JSON.stringify(ids)).not.toContain("phc_");
		expect(redactOperatorText("denied phx_sentinel and phc_sentinel")).toBe(
			"denied phx_<redacted> and phc_<redacted>",
		);
		expect(
			deletionReceipt({
				id: "11111111-1111-4111-8111-111111111111",
				status: "pending",
				count: 0,
				query: SENTINEL,
				value: SENTINEL,
			}),
		).toEqual({ id: "11111111-1111-4111-8111-111111111111", status: "pending", count: 0 });
	});
});
