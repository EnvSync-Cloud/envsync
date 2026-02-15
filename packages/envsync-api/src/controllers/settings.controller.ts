import { type Context } from "hono";

import { UserService } from "@/services/settings.service";

export class SettingsController {
	public static readonly getUserSettings = async (c: Context) => {
		try {
			const userId = c.get("user_id");

			if (!userId) {
				return c.json({ error: "User ID is required." }, 400);
			}

			const settings = await UserService.getUserSettings(userId);

			return c.json(settings, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateUserSettings = async (c: Context) => {
		try {
			const userId = c.get("user_id");
			const settings = await c.req.json();

			if (!userId || !settings) {
				return c.json({ error: "User ID and settings are required." }, 400);
			}

			await UserService.updateUserSettings(userId, settings);

			return c.json({ message: "User settings updated successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
