import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { LicenseController } from "../controllers/license.controller";
import { errorResponseSchema } from "envsync-api/ports/validators-common";
import { licenseActionResponseSchema, licenseStatusResponseSchema } from "envsync-api/ports/validators-license";

const app = new Hono();

app.get(
	"/status",
	describeRoute({
		operationId: "getManagementLicenseStatus",
		summary: "Get Management License Status",
		tags: ["License"],
		responses: {
			200: { description: "Current license status", content: { "application/json": { schema: resolver(licenseStatusResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	LicenseController.status,
);

app.post(
	"/activate",
	describeRoute({
		operationId: "activateManagementLicense",
		summary: "Activate Management License",
		tags: ["License"],
		responses: {
			200: { description: "License activated", content: { "application/json": { schema: resolver(licenseActionResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	LicenseController.activate,
);

app.post(
	"/verify",
	describeRoute({
		operationId: "verifyManagementLicense",
		summary: "Verify Management License",
		tags: ["License"],
		responses: {
			200: { description: "License verified", content: { "application/json": { schema: resolver(licenseActionResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	LicenseController.verify,
);

export default app;
