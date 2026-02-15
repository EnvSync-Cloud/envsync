import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";

export class OrgService {
	public static createOrg = async (data: {
		name: string;
		slug: string;
		logo_url?: string;
		size?: string;
		website?: string;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("orgs")
			.values({
				id: uuidv4(),
				...data,
				metadata: {},
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		return id;
	};

	public static getOrg = async (id: string) => {
		const db = await DB.getInstance();

		const org = await db
			.selectFrom("orgs")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return org;
	};

	public static updateOrg = async (
		id: string,
		data: {
			logo_url?: string;
			website?: string;
			name?: string;
			slug?: string;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("orgs")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
	};

	public static checkIfSlugExists = async (slug: string) => {
		const db = await DB.getInstance();

		const org = await db.selectFrom("orgs").selectAll().where("slug", "=", slug).executeTakeFirst();

		return !!org;
	};
}
