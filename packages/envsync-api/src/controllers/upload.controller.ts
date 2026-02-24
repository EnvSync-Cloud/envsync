import { type Context } from "hono";

import { Uploader } from "@/libs/store/s3";
import { config } from "@/utils/env";

export class UploadController {
	public static readonly uploadFile = async (c: Context) => {
		const upload = new Uploader(config.S3_BUCKET);

		const { file } = await c.req.parseBody();

		if (!file) {
			return c.json({ error: "File is required" }, 400);
		}

		if (typeof file == "string") {
			return c.json({ error: "Invalid file type" }, 400);
		}

		if (file.size > 5 * 1024 * 1024) {
			return c.json({ error: "File size exceeds 5MB limit" }, 400);
		}

		const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
		if (!ALLOWED_MIME_TYPES.includes(file.type)) {
			return c.json({ error: "File type not allowed" }, 400);
		}

		const s3_url = await upload.uploadFile("uploads", file, "public-read");

		return c.json(
			{
				message: "File uploaded successfully",
				s3_url,
			},
			200,
		);
	};
}
