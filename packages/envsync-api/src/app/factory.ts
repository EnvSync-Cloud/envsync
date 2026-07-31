import { SpanKind, SpanStatusCode, context, propagation } from "@opentelemetry/api";
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
import { csrfMiddleware } from "@/middlewares/csrf.middleware";
import { enterpriseLicenseLockMiddleware } from "@/middlewares/license-lock.middleware";
import type { ApiSurface } from "@/modules/types";
import { createApiRoutes } from "@/routes";
import { config } from "@/utils/env";
import { version } from "package.json";

export async function createApiApp(surface: ApiSurface) {
	const app = new Hono();
	const isManagement = surface === "management";
	const apiTitle = isManagement ? "EnvSync Management API" : "EnvSync API";
	const serverUrl = isManagement
		? config.MANAGEMENT_API_URL
		: `http://localhost:${config.PORT}`;
	const docsUrl = isManagement ? "/openapi" : "/openapi";
	const allowedOrigins = [
		config.DASHBOARD_URL,
		config.LANDING_PAGE_URL,
		config.MANAGEMENT_DASHBOARD_URL,
	].filter(Boolean);

	app.onError((err, c) => {
		if (err instanceof AppError) {
			return c.json({ error: err.message, code: err.code }, err.statusCode as ContentfulStatusCode);
		}

		if (err instanceof NoResultError) {
			return c.json({ error: "Resource not found", code: "NOT_FOUND" }, 404);
		}

		if (err instanceof SyntaxError || err.message?.includes("JSON Parse error")) {
			return c.json({ error: "Invalid JSON in request body", code: "BAD_REQUEST" }, 400);
		}

		if ((err as { code?: string }).code === "23503") {
			const detail = (err as { detail?: string; message?: string }).detail ?? err.message;
			return c.json({ error: `Foreign key constraint violation: ${detail}`, code: "VALIDATION_ERROR" }, 422);
		}

		log(`Unhandled error: ${err.message}`, LogTypes.ERROR, "GlobalErrorHandler");
		return c.json({ error: "Internal server error" }, 500);
	});

	app.use(async (ctx, next) => {
		const tracer = getTracer();
		const method = ctx.req.method;
		const url = new URL(ctx.req.url);
		const path = url.pathname;

		if (method === "OPTIONS") {
			await next();
			return;
		}

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
						span.setStatus({ code: status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK });
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
				if (!origin || allowedOrigins.includes(origin)) {
					return origin || "";
				}
				return "";
			},
			allowHeaders: ["Content-Type", "Authorization", "traceparent", "tracestate", "X-CSRF-Token", "X-EnvSync-Org-Id"],
			allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			credentials: true,
			maxAge: 3600,
		}),
	);

	app.use("/api/*", async (ctx, next) => {
		await next();
		const allowOrigin = ctx.res.headers.get("Access-Control-Allow-Origin");
		if (allowOrigin) {
			ctx.res.headers.set("Timing-Allow-Origin", allowOrigin);
		}
	});

	app.use("/api/*", csrfMiddleware());
	app.use(
		"/api/*",
		enterpriseLicenseLockMiddleware(
			isManagement
				? ["/api/license/status", "/api/license/activate", "/api/license/verify", "/api/system/status"]
				: ["/api/system/status", "/api/setup/status", "/api/setup/org"],
		),
	);

	app.use(logger());
	app.use(prettyJSON());
	app.use(poweredBy());

	app.get("/health", ctx => ctx.json({ status: "ok!", surface }));

	app.get("/health/mail", async ctx => {
		try {
			const { verifyMailConnection } = await import("@/libs/mail/config");
			await verifyMailConnection();
			return ctx.json({ status: "ok", smtp: { host: "connected" } });
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			return ctx.json({ status: "error", smtp: { error: message } }, 502);
		}
	});

	app.get("/favicon.ico", async ctx => ctx.redirect("https://hono.dev/images/logo-small.png"));

	app.route("/api", await createApiRoutes(surface));

	app.get(
		"/openapi",
		openAPISpecs(app, {
			documentation: {
				info: {
					title: apiTitle,
					version,
					description: `${apiTitle} documentation\n\nBearer-token clients can optionally send the \`X-EnvSync-Org-Id\` header to select an active organization for that request. Cookie sessions continue to use \`envsync_active_membership\`, and API-key requests ignore this header.`,
				},
				components: {
					parameters: {
						XEnvSyncOrgIdHeader: {
							name: "X-EnvSync-Org-Id",
							in: "header",
							required: false,
							description:
								"Optional. Bearer-token clients can use this to select the active organization for the request. Ignored for cookie sessions and API keys.",
							schema: {
								type: "string",
							},
						},
					},
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
					{ bearerAuth: [] },
					{ apiKeyAuth: [] },
				],
				servers: [
					{
						url: serverUrl,
						description: isManagement ? "Management server" : "Core server",
					},
				],
			},
		}),
	);

	app.get(
		"/docs",
		Scalar({
			theme: "elysiajs",
			url: docsUrl,
			title: `${apiTitle} via Scalar`,
		}),
	);

	app.get("/version", ctx => ctx.json({ version, surface }));

	return app;
}
