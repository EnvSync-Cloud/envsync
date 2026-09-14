import { describe, expect, test } from "bun:test";

import { captureAuditAnalytics } from "@/libs/posthog";

describe("captureAuditAnalytics", () => {
	test("does not throw when PostHog is unset", () => {
		expect(() =>
			captureAuditAnalytics({
				action: "app_created",
				org_id: "org_1",
				user_id: "user_1",
				details: { name: "api", value: "should-not-throw" },
			}),
		).not.toThrow();
	});

	test("ignores view-only audit actions", () => {
		expect(() =>
			captureAuditAnalytics({
				action: "apps_viewed",
				org_id: "org_1",
				user_id: "user_1",
				details: {},
			}),
		).not.toThrow();
	});
});
