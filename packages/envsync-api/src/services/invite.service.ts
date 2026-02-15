import { v4 as uuidv4 } from "uuid";
import { SecretKeyGenerator } from "sk-keygen";

import { DB } from "@/libs/db";

export class InviteService {
	public static createOrgInvite = async (email: string) => {
		const db = await DB.getInstance();
		const { invite_token } = await db
			.insertInto("invite_org")
			.values({
				id: uuidv4(),
				email,
				invite_token: SecretKeyGenerator.generateKey(),
				is_accepted: false,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return invite_token;
	};

	public static createUserInvite = async (email: string, org_id: string, role_id: string) => {
		const db = await DB.getInstance();
		const { id, invite_token } = await db
			.insertInto("invite_user")
			.values({
				id: uuidv4(),
				email,
				invite_token: SecretKeyGenerator.generateKey(),
				is_accepted: false,
				org_id,
				role_id,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return { invite_token, id };
	};

	public static getOrgInviteByCode = async (invite_code: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_org")
			.selectAll()
			.where("invite_token", "=", invite_code)
			.executeTakeFirstOrThrow();

		return invite;
	};

	public static getUserInviteByCode = async (invite_code: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_user")
			.selectAll()
			.where("invite_token", "=", invite_code)
			.executeTakeFirstOrThrow();

		return invite;
	};

	public static deleteInvite = async (invite_id: string) => {
		const db = await DB.getInstance();
		await db.deleteFrom("invite_org").where("id", "=", invite_id).executeTakeFirstOrThrow();
	};

	public static deleteUserInvite = async (invite_id: string) => {
		const db = await DB.getInstance();
		await db.deleteFrom("invite_user").where("id", "=", invite_id).executeTakeFirstOrThrow();
	};

	public static getAllUserInvites = async (org_id: string) => {
		const db = await DB.getInstance();
		const invites = await db
			.selectFrom("invite_user")
			.where("org_id", "=", org_id)
			.selectAll()
			.execute();

		return invites;
	};

	public static updateOrgInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
		},
	) => {
		const db = await DB.getInstance();
		await db
			.updateTable("invite_org")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();
	};

	public static updateUserInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
			role_id?: string;
		},
	) => {
		const db = await DB.getInstance();
		await db
			.updateTable("invite_user")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();
	};

	public static getUserInviteById = async (invite_id: string) => {
		const db = await DB.getInstance();
		const invite = await db
			.selectFrom("invite_user")
			.selectAll()
			.where("id", "=", invite_id)
			.executeTakeFirstOrThrow();

		return invite;
	};
}
