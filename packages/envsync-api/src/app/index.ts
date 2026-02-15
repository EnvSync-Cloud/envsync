import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { poweredBy } from "hono/powered-by";
import { prettyJSON } from "hono/pretty-json";
import { openAPISpecs } from "hono-openapi";

import log, { LogTypes } from "@/libs/logger";
import routes from "@/routes";
import { config } from "@/utils/env";
import { version } from "package.json";

const app = new Hono();

app.use(
	cors({
		origin: "*",
		allowHeaders: ["Content-Type", "Authorization"],
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
