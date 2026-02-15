import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { AuthController } from "@/controllers/auth.controller";
import { whoAmIResponseSchema } from "@/validators/auth.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/me",
	describeRoute({
		operationId: "whoami",
		summary: "Get Current User",
		description:
			"Retrieve the current authenticated user's information and their organization details",
		tags: ["Authentication"],
		responses: {
			200: {
				description: "User information retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(whoAmIResponseSchema),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	AuthController.whoami,
);

export default app;
