import z from "zod";
import "zod-openapi/extend";

export const uploadFileSchema = z.object({
	file: z.instanceof(File).refine(file => file.size < 5 * 1024 * 1024, {
		message: "File must be less than 5MB",
	}),
});

export const uploadFileResponseSchema = z
	.object({
		message: z.string().openapi({ example: "File uploaded successfully" }),
		s3_url: z
			.string()
			.url()
			.openapi({ example: "https://s3.amazonaws.com/bucket/uploads/file.jpg" }),
	})
	.openapi({ ref: "UploadFileResponse" });

export const uploadFileErrorSchema = z
	.object({
		error: z.string().openapi({ example: "File is required" }),
	})
	.openapi({ ref: "UploadFileError" });
