import { Hono } from "hono";

import {
	forwardTelemetryRequest,
	normalizeProxyPath,
	otelProxyOrigin,
	posthogIngestOrigin,
	resolveObsUpstream,
	resolvePosthogUpstream,
	telemetryPreflightResponse,
	withTelemetryCors,
} from "@/libs/telemetry-proxy";

async function proxy(ctx: { req: { method: string; path: string; url: string; raw: Request } }, prefix: "/ph" | "/obs") {
	const origin = ctx.req.raw.headers.get("origin");
	if (ctx.req.method === "OPTIONS") {
		return telemetryPreflightResponse(origin);
	}
	const path = normalizeProxyPath(new URL(ctx.req.url).pathname, prefix);
	if (!path) {
		return withTelemetryCors(new Response("Invalid path", { status: 400 }), origin);
	}
	const target = prefix === "/ph" ? resolvePosthogUpstream(path) : resolveObsUpstream(path);
	if (!target) {
		return withTelemetryCors(new Response("Not found", { status: 404 }), origin);
	}
	const search = new URL(ctx.req.url).search;
	const body =
		ctx.req.method === "GET" || ctx.req.method === "HEAD"
			? null
			: await ctx.req.raw.arrayBuffer();
	const upstream = await forwardTelemetryRequest({
		method: ctx.req.method,
		target,
		search,
		headers: ctx.req.raw.headers,
		body,
	});
	return withTelemetryCors(upstream, origin);
}

const ph = new Hono();
ph.get("/", ctx => ctx.json({ ok: true, proxy: "posthog", upstream: posthogIngestOrigin() }));
ph.get("/ready", ctx => ctx.body(null, 204));
ph.all("/*", ctx => proxy(ctx, "/ph"));

const obs = new Hono();
obs.get("/", ctx => ctx.json({ ok: true, proxy: "otel", upstream: otelProxyOrigin() }));
obs.get("/ready", ctx => ctx.body(null, 204));
obs.all("/*", ctx => proxy(ctx, "/obs"));

export const posthogProxyRouter = ph;
export const obsProxyRouter = obs;
