import z from "zod";

// For extending the Zod schema with OpenAPI properties
import "zod-openapi/extend";

export const errorResponseSchema = z
	.object({
		error: z.string().openapi({ example: "An error occurred." }),
	})
	.openapi({ ref: "ErrorResponse" });
