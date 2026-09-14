import { config } from "@/utils/env";

const HOP_BY_HOP = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailers",
	"transfer-encoding",
	"upgrade",
	"host",
	"cookie",
	"authorization",
	"set-cookie",
]);

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "HEAD", "OPTIONS"]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const OBS_PATHS = new Set(["/v1/traces", "/v1/logs", "/v1/metrics"]);

export function posthogIngestOrigin(host = config.POSTHOG_HOST): string {
	return host.replace(/\/$/, "") || "https://us.i.posthog.com";
}

export function posthogAssetsOrigin(ingest = posthogIngestOrigin()): string {
	if (config.POSTHOG_ASSETS_HOST) {
		return config.POSTHOG_ASSETS_HOST.replace(/\/$/, "");
	}
	try {
		const url = new URL(ingest);
		if (url.hostname.startsWith("eu.")) {
			url.hostname = url.hostname.replace(/^eu\./, "eu-assets.");
		} else if (url.hostname.startsWith("us.")) {
			url.hostname = url.hostname.replace(/^us\./, "us-assets.");
		} else {
			return "https://us-assets.i.posthog.com";
		}
		return url.origin;
	} catch {
		return "https://us-assets.i.posthog.com";
	}
}

export function otelProxyOrigin(): string {
	return (config.OTEL_BROWSER_PROXY_TARGET || config.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:14318").replace(
		/\/$/,
		"",
	);
}

export function normalizeProxyPath(rawPath: string, prefix: "/ph" | "/obs"): string | null {
	const stripped = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath;
	const path = stripped.startsWith("/") ? stripped : `/${stripped}`;
	if (path.includes("..") || path.includes("\\") || path.includes("://")) {
		return null;
	}
	return path === "" ? "/" : path;
}

export function resolvePosthogUpstream(path: string): { origin: string; urlPath: string } | null {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	if (normalized === "/" || normalized === "/ready") {
		return null;
	}
	if (normalized.startsWith("/static/")) {
		return { origin: posthogAssetsOrigin(), urlPath: normalized };
	}
	return { origin: posthogIngestOrigin(), urlPath: normalized };
}

export function resolveObsUpstream(path: string): { origin: string; urlPath: string } | null {
	const normalized = path.startsWith("/") ? path : `/${path}`;
	if (normalized === "/" || normalized === "/ready") {
		return null;
	}
	if (!OBS_PATHS.has(normalized)) {
		return null;
	}
	return { origin: otelProxyOrigin(), urlPath: normalized };
}

export async function forwardTelemetryRequest(input: {
	method: string;
	target: { origin: string; urlPath: string };
	search: string;
	headers: Headers;
	body: ArrayBuffer | null;
}): Promise<Response> {
	if (!ALLOWED_METHODS.has(input.method.toUpperCase())) {
		return new Response("Method not allowed", { status: 405 });
	}
	if (input.body && input.body.byteLength > MAX_BODY_BYTES) {
		return new Response("Payload too large", { status: 413 });
	}

	const outbound = new Headers();
	input.headers.forEach((value, key) => {
		if (HOP_BY_HOP.has(key.toLowerCase())) return;
		outbound.set(key, value);
	});

	const url = `${input.target.origin}${input.target.urlPath}${input.search}`;
	return fetch(url, {
		method: input.method,
		headers: outbound,
		body: input.method === "GET" || input.method === "HEAD" ? undefined : input.body,
		redirect: "manual",
	});
}
