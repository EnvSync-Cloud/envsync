import { describe, expect, test } from "bun:test";

import {
	mapPublicPosthogPathToUpstream,
	rewritePosthogPublicPathname,
	rewritePosthogRequestUrl,
} from "./posthog-paths";

describe("PostHog first-party path rewrites", () => {
	test("browser never requests /flags/", () => {
		expect(rewritePosthogPublicPathname("/ph/flags/")).toBe("/ph/cfg/");
		expect(rewritePosthogPublicPathname("/ph/e/")).toBe("/ph/ev/");
		expect(rewritePosthogPublicPathname("/ph/batch")).toBe("/ph/q");
		expect(rewritePosthogPublicPathname("/ph/static/array.js")).toBe("/ph/a/array.js");
	});

	test("proxy maps public paths back to PostHog", () => {
		expect(mapPublicPosthogPathToUpstream("/cfg/")).toBe("/flags/");
		expect(mapPublicPosthogPathToUpstream("/ev/")).toBe("/e/");
		expect(mapPublicPosthogPathToUpstream("/q")).toBe("/batch");
		expect(mapPublicPosthogPathToUpstream("/a/array.js")).toBe("/static/array.js");
		expect(mapPublicPosthogPathToUpstream("/e/")).toBe("/e/");
	});

	test("rewriteRequestUrl keeps query string", () => {
		const url = rewritePosthogRequestUrl(new URL("https://t.envsync.cloud/ph/flags/?v=2&compression=base64"));
		expect(url.pathname).toBe("/ph/cfg/");
		expect(url.search).toBe("?v=2&compression=base64");
	});
});
