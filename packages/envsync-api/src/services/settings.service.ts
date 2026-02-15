import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";

export class UserService {
	public static createUserSettings = async (user_id: string) => {
		const db = await DB.getInstance();

		await db
			.insertInto("settings")
			.values({
				id: uuidv4(),
				user_id,
				email_notifications: true,
				theme: "dark",
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
	};

	public static getUserSettings = async (user_id: string) => {
		const db = await DB.getInstance();

		const settings = await db
			.selectFrom("settings")
			.selectAll()
			.where("user_id", "=", user_id)
			.executeTakeFirstOrThrow();

		return settings;
	};

	public static updateUserSettings = async (
		user_id: string,
		data: {
			email_notifications?: boolean;
			theme?: string;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("settings")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("user_id", "=", user_id)
			.execute();
	};

	public static deleteUserSettings = async (user_id: string) => {
		const db = await DB.getInstance();

		await db.deleteFrom("settings")
			.where("user_id", "=", user_id)
			.execute();
	};
}
