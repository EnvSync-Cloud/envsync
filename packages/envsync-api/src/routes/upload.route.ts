import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { UploadController } from "@/controllers/upload.controller";
import {
	uploadFileErrorSchema,
	uploadFileResponseSchema,
	uploadFileSchema,
} from "@/validators/upload.validator";

const app = new Hono();

app.use(authMiddleware());

app.post(
	"/file",
	describeRoute({
		operationId: "uploadFile",
		summary: "Upload File",
		description: "Upload a file to the server. The file should be less than 5MB in size.",
		tags: ["File Upload"],
		responses: {
			200: {
				description: "File uploaded successfully",
				content: {
					"application/json": {
						schema: resolver(uploadFileResponseSchema),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: resolver(uploadFileErrorSchema),
					},
				},
			},
		},
	}),
	zValidator("form", uploadFileSchema),
	UploadController.uploadFile,
);

export default app;
