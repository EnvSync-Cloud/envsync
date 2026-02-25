import { STDBClient } from "@/libs/stdb";

export class UserService {
	public static createUserSettings = async (user_id: string) => {
		const stdb = STDBClient.getInstance();
		const uuid = crypto.randomUUID();

		await stdb.callReducer("create_settings", [uuid, user_id, true, "dark"], {
			injectRootKey: false,
		});
	};

	public static getUserSettings = async (user_id: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{
			uuid: string;
			user_id: string;
			email_notifications: boolean;
			theme: string;
			created_at: number;
			updated_at: number;
		}>(`SELECT * FROM user_settings WHERE user_id = '${user_id}'`);

		if (!row) {
			throw new Error("no result");
		}

		return {
			id: row.uuid,
			user_id: row.user_id,
			email_notifications: row.email_notifications,
			theme: row.theme,
			created_at: new Date(Number(row.created_at) / 1000),
			updated_at: new Date(Number(row.updated_at) / 1000),
		};
	};

	public static updateUserSettings = async (
		user_id: string,
		data: {
			email_notifications?: boolean;
			theme?: string;
		},
	) => {
		const stdb = STDBClient.getInstance();

		// Fetch current settings to merge with partial update
		const current = await stdb.queryOne<{
			email_notifications: boolean;
			theme: string;
		}>(`SELECT * FROM user_settings WHERE user_id = '${user_id}'`);

		if (!current) {
			throw new Error("no result");
		}

		await stdb.callReducer(
			"update_settings",
			[
				user_id,
				data.email_notifications ?? current.email_notifications,
				data.theme ?? current.theme,
			],
			{ injectRootKey: false },
		);
	};

	public static deleteUserSettings = async (user_id: string) => {
		const stdb = STDBClient.getInstance();

		await stdb.callReducer("delete_settings", [user_id], {
			injectRootKey: false,
		});
	};
}
