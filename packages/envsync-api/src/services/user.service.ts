import { v4 as uuidv4 } from "uuid";

import { createZitadelUser } from "@/helpers/zitadel";
import { DB } from "@/libs/db";

export class UserService {
	public static createUser = async (data: {
		email: string;
		full_name: string;
		password: string;
		org_id: string;
		role_id: string;
	}) => {
		const db = await DB.getInstance();

		const parts = data.full_name.trim().split(/\s+/).filter(Boolean);
		const firstName = parts[0]?.slice(0, 200) ?? "User";
		const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

		const zUser = await createZitadelUser({
			userName: data.email,
			email: data.email,
			firstName,
			lastName,
			password: data.password,
		});

		const { id } = await db
			.insertInto("users")
			.values({
				id: uuidv4(),
				is_active: true,
				email: data.email,
				org_id: data.org_id,
				role_id: data.role_id,
				auth_service_id: zUser.id,
				full_name: data.full_name,
				profile_picture_url: null,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		return { id };
	};

	public static getUser = async (id: string) => {
		const db = await DB.getInstance();

		const user = await db
			.selectFrom("users")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return user;
	};

	public static getAllUser = async (org_id: string) => {
		const db = await DB.getInstance();

		const user = await db.selectFrom("users").selectAll().where("org_id", "=", org_id).execute();

		return user;
	};

	public static updateUser = async (
		id: string,
		data: {
			full_name?: string;
			profile_picture_url?: string;
			role_id?: string;
			email?: string;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("users")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	};

	public static deleteUser = async (id: string) => {
		const db = await DB.getInstance();

		await db.deleteFrom("users").where("id", "=", id).executeTakeFirstOrThrow();
	};

	public static getUserByKeycloakId = async (auth_service_id: string) => {
		const db = await DB.getInstance();
		const user = await db
			.selectFrom("users")
			.selectAll()
			.where("auth_service_id", "=", auth_service_id)
			.executeTakeFirstOrThrow();
		return user;
	};

	public static getUserByIdpId = (idpId: string) => UserService.getUserByKeycloakId(idpId);
}
