import { SpanKind, SpanStatusCode, context, propagation, trace } from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { prettyJSON } from "hono/pretty-json";
import { openAPISpecs } from "hono-openapi";

import { NoResultError } from "kysely";

import { AppError } from "@/libs/errors";
import log, { LogTypes, apiResponseLogger } from "@/libs/logger";
import { getTracer } from "@/libs/telemetry";
import { httpRequestDuration } from "@/libs/telemetry/metrics";
import routes from "@/routes";
import { config } from "@/utils/env";
import { version } from "package.json";

const app = new Hono();

// Global error handler — maps typed errors to proper HTTP status codes
app.onError((err, c) => {
	// 1. Typed application errors (NotFoundError, ValidationError, etc.)
	if (err instanceof AppError) {
		return c.json({ error: err.message, code: err.code }, err.statusCode as ContentfulStatusCode);
	}

	// 2. Kysely NoResultError — unwrapped executeTakeFirstOrThrow()
	if (err instanceof NoResultError) {
		return c.json({ error: "Resource not found", code: "NOT_FOUND" }, 404);
	}

	// 3. Malformed JSON body
	if (err instanceof SyntaxError || err.message?.includes("JSON Parse error")) {
		return c.json({ error: "Invalid JSON in request body", code: "BAD_REQUEST" }, 400);
	}

	// 4. PostgreSQL FK constraint violation (code 23503)
	if ((err as any).code === "23503") {
		const detail = (err as any).detail ?? err.message;
		return c.json({ error: `Foreign key constraint violation: ${detail}`, code: "VALIDATION_ERROR" }, 422);
	}

	log(`Unhandled error: ${err.message}`, LogTypes.ERROR, "GlobalErrorHandler");
	return c.json({ error: "Internal server error" }, 500);
});

// OTEL HTTP tracing middleware — must be before all other middleware
app.use(async (ctx, next) => {
	const tracer = getTracer();
	const method = ctx.req.method;
	const url = new URL(ctx.req.url);
	const path = url.pathname;

	// Skip tracing for CORS preflight requests
	if (method === "OPTIONS") {
		await next();
		return;
	}

	// Extract W3C trace context from incoming headers
	const parentContext = propagation.extract(context.active(), ctx.req.raw.headers, {
		get(carrier, key) {
			return (carrier as Headers).get(key) ?? undefined;
		},
		keys(carrier) {
			const headers = carrier as Headers;
			const result: string[] = [];
			headers.forEach((_v, k) => result.push(k));
			return result;
		},
	});

	await context.with(parentContext, async () => {
		await tracer.startActiveSpan(
			`${method} ${path}`,
			{
				kind: SpanKind.SERVER,
				attributes: {
					"http.method": method,
					"http.url": ctx.req.url,
					"url.path": path,
					"http.target": url.pathname + url.search,
				},
			},
			async span => {
				const start = performance.now();
				try {
					await next();
					const status = ctx.res.status;
					span.setAttribute("http.status_code", status);
					span.setAttribute("http.route", ctx.req.routePath ?? path);
					if (status >= 400) {
						span.setStatus({ code: SpanStatusCode.ERROR });
					} else {
						span.setStatus({ code: SpanStatusCode.OK });
					}
				} catch (error) {
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: error instanceof Error ? error.message : String(error),
					});
					if (error instanceof Error) {
						span.recordException(error);
					}
					throw error;
				} finally {
					const duration = performance.now() - start;
					const route = ctx.req.routePath ?? path;
					const status = ctx.res.status;
					httpRequestDuration.record(duration, {
						"http.method": method,
						"http.route": route,
						"http.status_code": status,
					});

					// Emit structured HTTP request log to Loki via OTel
					const otelLogger = logs.getLogger("envsync-api");
					otelLogger.emit({
						severityNumber: status >= 500 ? SeverityNumber.ERROR : status >= 400 ? SeverityNumber.WARN : SeverityNumber.INFO,
						severityText: status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
						body: `${method} ${route} ${status} ${duration.toFixed(1)}ms`,
						attributes: {
							"http.method": method,
							"http.route": route,
							"http.status_code": status,
							"http.duration_ms": Math.round(duration),
							"http.url": ctx.req.url,
							"log.type": "http_request",
							"trace.id": span.spanContext().traceId,
							"span.id": span.spanContext().spanId,
							"envsync.user_id": (ctx.get as (k: string) => string | undefined)("user_id") ?? "",
							"envsync.org_id": (ctx.get as (k: string) => string | undefined)("org_id") ?? "",
							"envsync.org_name": (ctx.get as (k: string) => string | undefined)("org_name") ?? "",
							"envsync.role_name": (ctx.get as (k: string) => string | undefined)("role_name") ?? "",
						},
					});

					apiResponseLogger.info({
						method,
						route,
						status,
						duration_ms: Math.round(duration),
						url: ctx.req.url,
						user_id: (ctx.get as (k: string) => string | undefined)("user_id") ?? "",
						org_id: (ctx.get as (k: string) => string | undefined)("org_id") ?? "",
					});

					span.end();
				}
			},
		);
	});
});

app.use(
	cors({
		origin: (origin) => {
			const allowedOrigins = [
				config.DASHBOARD_URL,
				config.LANDING_PAGE_URL,
			].filter(Boolean);
			// Allow if origin matches an allowed origin, or if no origin (same-origin/non-browser)
			if (!origin || allowedOrigins.includes(origin)) {
				return origin || "";
			}
			return "";
		},
		allowHeaders: ["Content-Type", "Authorization", "traceparent", "tracestate"],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		maxAge: 3600,
	}),
);

app.use(logger());
app.use(prettyJSON());
app.use(poweredBy());

app.get("/health", ctx => ctx.json({ status: "ok!" }));

app.get("/favicon.ico", async ctx => {
	return ctx.redirect("https://hono.dev/images/logo-small.png");
});

app.route("/api", routes);

app.get(
	"/openapi",
	openAPISpecs(app, {
		documentation: {
			info: {
				title: "EnvSync API",
				version: version,
				description: "API Documentation",
			},
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
					apiKeyAuth: {
						type: "apiKey",
						in: "header",
						name: "X-API-Key",
					},
				},
			},
			security: [
				{
					bearerAuth: [],
				},
				{
					apiKeyAuth: [],
				},
			],
			servers: [
				{
					url: "http://localhost:" + config.PORT,
					description: "Local server",
				},
				{
					url: "https://api.envsync.cloud",
					description: "Production server",
				},
			],
		},
	}),
);

app.get(
	"/docs",
	Scalar({
		theme: "elysiajs",
		url: "/openapi",
		title: "EnvSync API via Scalar",
	}),
);

app.get("/version", ctx => {
	return ctx.json({
		version,
	});
});

const apiRoutes = app.routes;
log("API Routes:", LogTypes.LOGS, "Entrypoint");
apiRoutes.forEach(route => {
	log(`Method: ${route.method}, Path: ${route.path}`, LogTypes.LOGS, "Entrypoint");
});

log(`Server started at http://localhost:${config.PORT}`, LogTypes.LOGS, "Entrypoint");

export { app };
