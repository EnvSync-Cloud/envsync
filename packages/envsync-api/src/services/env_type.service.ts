import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";

export class EnvTypeService {
	public static createEnvType = async ({
		name,
		org_id,
		app_id,
		color,
		is_default,
		is_protected,
	}: {
		name: string;
		org_id: string;
		app_id: string;
		color: string;
		is_default: boolean;
		is_protected: boolean;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("env_type")
			.values({
				id: uuidv4(),
				name,
				org_id,
				app_id,
				color,
				is_default,
				is_protected,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		return { id, name };
	};

	public static getEnvTypes = async (org_id: string) => {
		const db = await DB.getInstance();

		const env_types = await db
			.selectFrom("env_type")
			.selectAll()
			.where("org_id", "=", org_id)
			.execute();

		return env_types;
	};

	public static getEnvType = async (id: string) => {
		const db = await DB.getInstance();

		const env_type = await db
			.selectFrom("env_type")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return env_type;
	};

	public static updateEnvType = async (
		id: string,
		data: {
			name?: string;
			color?: string;
			is_default?: boolean;
			is_protected?: boolean;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("env_type")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	};

	public static deleteEnvType = async (id: string) => {
		const db = await DB.getInstance();

		await db.deleteFrom("env_type").where("id", "=", id).execute();
	};
}
