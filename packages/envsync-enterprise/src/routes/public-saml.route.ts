import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { SamlController } from "../controllers/saml.controller";
import { errorResponseSchema } from "envsync-api/ports/validators-common";
import {
	publicSamlSsoRequestSchema,
	samlSsoResponseSchema,
} from "../validators/saml.validator";

const app = new Hono();

app.get(
	"/metadata/:orgId",
	describeRoute({
		operationId: "getPublicSamlMetadata",
		summary: "Get public SAML SP metadata",
		description: "Unauthenticated SP metadata XML for the organization",
		tags: ["SAML SSO"],
		security: [],
		responses: {
			200: {
				description: "SP metadata XML",
				content: { "application/xml": { schema: { type: "string" } } },
			},
			404: {
				description: "SSO is not available",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	SamlController.getPublicMetadata,
);

app.post(
	"/acs/:orgId",
	describeRoute({
		operationId: "handlePublicSamlAcs",
		summary: "SAML Assertion Consumer Service",
		description: "Receive and validate a SAML Response from the identity provider",
		tags: ["SAML SSO"],
		security: [],
		responses: {
			302: {
				description: "Authentication successful",
			},
			401: {
				description: "Authentication failed",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	SamlController.handlePublicAcs,
);

app.post(
	"/sso/:orgSlug",
	describeRoute({
		operationId: "startPublicSamlSso",
		summary: "Start SAML SSO",
		description: "Unauthenticated SP-initiated start. Returns a redirect URL for the login page or CLI.",
		tags: ["SAML SSO"],
		security: [],
		responses: {
			200: {
				description: "Redirect URL generated",
				content: { "application/json": { schema: resolver(samlSsoResponseSchema) } },
			},
			404: {
				description: "SSO is not available",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", publicSamlSsoRequestSchema),
	SamlController.startPublicSso,
);

app.get(
	"/sso/:orgSlug",
	describeRoute({
		operationId: "startPublicSamlSsoRedirect",
		summary: "Bookmark SAML SSO start",
		description: "Success redirects to the IdP. Any error redirects to the dashboard login page.",
		tags: ["SAML SSO"],
		security: [],
		responses: {
			302: {
				description: "Redirect to the IdP or /login?sso=failed",
			},
		},
	}),
	SamlController.startPublicSsoRedirect,
);

export default app;
export { app as publicSamlRouter };
