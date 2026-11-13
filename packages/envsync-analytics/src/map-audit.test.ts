import { describe, expect, test } from "bun:test";

import {
	detectAnalyticsSource,
	mapAuditActionToAnalyticsEvent,
	sanitizeAnalyticsProperties,
} from "./map-audit";

describe("mapAuditActionToAnalyticsEvent", () => {
	test("maps mutations and ignores views", () => {
		expect(mapAuditActionToAnalyticsEvent("app_created")).toBe("app_created");
		expect(mapAuditActionToAnalyticsEvent("env_updated")).toBe("env_upserted");
		expect(mapAuditActionToAnalyticsEvent("secret_created")).toBe("secret_upserted");
		expect(mapAuditActionToAnalyticsEvent("apps_viewed")).toBeNull();
		expect(mapAuditActionToAnalyticsEvent("get_audit_logs")).toBeNull();
	});
});

describe("sanitizeAnalyticsProperties", () => {
	test("keeps allowlisted metadata and drops every other field", () => {
		expect(
			sanitizeAnalyticsProperties({
				app_id: "app_1",
				key: "DATABASE_URL",
				value: "write-sentinel-value",
				old_value: "update-old-sentinel",
				new_value: "update-new-sentinel",
				password: "x",
				note: "not-on-the-allowlist",
				nested: { nope: true },
				count: 2,
			}),
		).toEqual({ app_id: "app_1", key: "DATABASE_URL", count: 2 });
	});
});

describe("detectAnalyticsSource", () => {
	test("prefers explicit client header then UA", () => {
		expect(detectAnalyticsSource("Mozilla/5.0", "cli")).toBe("cli");
		expect(detectAnalyticsSource("envsync-cli/0.20.7")).toBe("cli");
		expect(detectAnalyticsSource("Mozilla/5.0 Firefox/155.0")).toBe("web");
		expect(detectAnalyticsSource("curl/8.0")).toBe("api");
	});
});
