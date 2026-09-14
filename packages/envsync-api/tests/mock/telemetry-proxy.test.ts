import { afterEach, describe, expect, test } from "bun:test";

import {
	normalizeProxyPath,
	posthogAssetsOrigin,
	posthogIngestOrigin,
	resolveObsUpstream,
	resolvePosthogUpstream,
} from "@/libs/telemetry-proxy";
import { testRequest } from "../helpers/request";

describe("telemetry proxy path rules", () => {
	test("strips /ph and /obs prefixes and rejects traversal", () => {
		expect(normalizeProxyPath("/ph/e/", "/ph")).toBe("/e/");
		expect(normalizeProxyPath("/obs/v1/traces", "/obs")).toBe("/v1/traces");
		expect(normalizeProxyPath("/ph/../secret", "/ph")).toBeNull();
		expect(normalizeProxyPath("/ph/https://evil.test", "/ph")).toBeNull();
	});

	test("routes PostHog static assets to the assets origin", () => {
		expect(resolvePosthogUpstream("/e/")).toEqual({
			origin: posthogIngestOrigin(),
			urlPath: "/e/",
		});
		expect(resolvePosthogUpstream("/static/array.js")).toEqual({
			origin: posthogAssetsOrigin(),
			urlPath: "/static/array.js",
		});
		expect(resolvePosthogUpstream("/cfg/")).toEqual({
			origin: posthogIngestOrigin(),
			urlPath: "/flags/",
		});
		expect(resolvePosthogUpstream("/a/array.js")).toEqual({
			origin: posthogAssetsOrigin(),
			urlPath: "/static/array.js",
		});
		expect(resolvePosthogUpstream("/")).toBeNull();
	});

	test("allows only OTLP HTTP paths for /obs", () => {
		expect(resolveObsUpstream("/v1/traces")?.urlPath).toBe("/v1/traces");
		expect(resolveObsUpstream("/v1/logs")?.urlPath).toBe("/v1/logs");
		expect(resolveObsUpstream("/api/dashboards")).toBeNull();
	});
});

describe("telemetry proxy HTTP", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("GET /ph and /obs are ready without calling upstream", async () => {
		const ph = await testRequest("/ph");
		const obs = await testRequest("/obs");
		expect(ph.status).toBe(200);
		expect(await ph.json()).toMatchObject({ ok: true, proxy: "posthog" });
		expect(obs.status).toBe(200);
		expect(await obs.json()).toMatchObject({ ok: true, proxy: "otel" });
	});

	test("forwards /ph/e/ to PostHog ingest and strips cookies", async () => {
		const seen: { url: string; cookie: string | null }[] = [];
		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const req = new Request(input, init);
			seen.push({ url: req.url, cookie: req.headers.get("cookie") });
			return new Response(JSON.stringify({ status: 1 }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as typeof fetch;

		const res = await testRequest("/ph/e/", {
			method: "POST",
			headers: { "content-type": "application/json", cookie: "access_token=secret" },
			body: { event: "app_created" },
		});
		expect(res.status).toBe(200);
		expect(seen[0]?.url.startsWith(`${posthogIngestOrigin()}/e/`)).toBe(true);
		expect(seen[0]?.cookie).toBeNull();
	});

	test("rejects unknown /obs paths", async () => {
		const res = await testRequest("/obs/admin");
		expect(res.status).toBe(404);
	});
});
