import { Hono } from "hono";
import { describeRoute } from "hono-openapi";

import { authMiddleware } from "envsync-api/ports/middlewares";
import { enterpriseGuard } from "envsync-api/ports/middlewares";
import { requirePermission } from "envsync-api/ports/middlewares";

import { AcmeController } from "../controllers/acme.controller";

const app = new Hono();

app.use(authMiddleware());
app.use(enterpriseGuard("management"));

app.post(
	"/eab",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "createAcmeEab",
		summary: "Create ACME External Account Binding credentials",
		tags: ["ACME"],
		responses: { 201: { description: "EAB created" } },
	}),
	AcmeController.createEab,
);

app.get(
	"/eab",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "listAcmeEab",
		summary: "List ACME EAB key ids",
		tags: ["ACME"],
		responses: { 200: { description: "EAB keys" } },
	}),
	AcmeController.listEab,
);

export default app;
