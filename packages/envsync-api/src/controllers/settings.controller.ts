import { type Context } from "hono";

import { UserService } from "@/services/settings.service";

export class SettingsController {
	public static readonly getUserSettings = async (c: Context) => {
		const userId = c.get("user_id");

		if (!userId) {
			return c.json({ error: "User ID is required." }, 400);
		}

		const settings = await UserService.getUserSettings(userId);

		return c.json(settings, 200);
	};

	public static readonly updateUserSettings = async (c: Context) => {
		const userId = c.get("user_id");
		const { email_notifications, theme } = await c.req.json();

		if (!userId) {
			return c.json({ error: "User ID is required." }, 400);
		}

		await UserService.updateUserSettings(userId, { email_notifications, theme });

		return c.json({ message: "User settings updated successfully." }, 200);
	};
}
