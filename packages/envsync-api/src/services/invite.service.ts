import { SecretKeyGenerator } from "sk-keygen";

import { STDBClient } from "@/libs/stdb";

export class InviteService {
	public static createOrgInvite = async (email: string) => {
		const stdb = STDBClient.getInstance();
		const uuid = crypto.randomUUID();
		const invite_token = SecretKeyGenerator.generateKey();

		await stdb.callReducer("create_org_invite", [uuid, email, invite_token], {
			injectRootKey: false,
		});

		return invite_token;
	};

	public static createUserInvite = async (email: string, org_id: string, role_id: string) => {
		const stdb = STDBClient.getInstance();
		const uuid = crypto.randomUUID();
		const invite_token = SecretKeyGenerator.generateKey();

		await stdb.callReducer(
			"create_user_invite",
			[uuid, email, role_id, invite_token, org_id],
			{ injectRootKey: false },
		);

		return { invite_token, id: uuid };
	};

	public static getOrgInviteByCode = async (invite_code: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{
			uuid: string;
			email: string;
			invite_token: string;
			is_accepted: boolean;
			created_at: number;
			updated_at: number;
		}>(`SELECT * FROM invite_org WHERE invite_token = '${invite_code}'`);

		if (!row) {
			throw new Error("no result");
		}

		return {
			id: row.uuid,
			email: row.email,
			invite_token: row.invite_token,
			is_accepted: row.is_accepted,
			created_at: new Date(Number(row.created_at) / 1000),
			updated_at: new Date(Number(row.updated_at) / 1000),
		};
	};

	public static getUserInviteByCode = async (invite_code: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{
			uuid: string;
			email: string;
			role_id: string;
			invite_token: string;
			is_accepted: boolean;
			org_id: string;
			created_at: number;
			updated_at: number;
		}>(`SELECT * FROM invite_user WHERE invite_token = '${invite_code}'`);

		if (!row) {
			throw new Error("no result");
		}

		return {
			id: row.uuid,
			email: row.email,
			role_id: row.role_id,
			invite_token: row.invite_token,
			is_accepted: row.is_accepted,
			org_id: row.org_id,
			created_at: new Date(Number(row.created_at) / 1000),
			updated_at: new Date(Number(row.updated_at) / 1000),
		};
	};

	public static deleteInvite = async (invite_id: string) => {
		const stdb = STDBClient.getInstance();

		await stdb.callReducer("delete_org_invite", [invite_id], {
			injectRootKey: false,
		});
	};

	public static deleteUserInvite = async (invite_id: string) => {
		const stdb = STDBClient.getInstance();

		await stdb.callReducer("delete_user_invite", [invite_id], {
			injectRootKey: false,
		});
	};

	public static getAllUserInvites = async (org_id: string) => {
		const stdb = STDBClient.getInstance();

		const rows = await stdb.query<{
			uuid: string;
			email: string;
			role_id: string;
			invite_token: string;
			is_accepted: boolean;
			org_id: string;
			created_at: number;
			updated_at: number;
		}>(`SELECT * FROM invite_user WHERE org_id = '${org_id}'`);

		return rows.map((row) => ({
			id: row.uuid,
			email: row.email,
			role_id: row.role_id,
			invite_token: row.invite_token,
			is_accepted: row.is_accepted,
			org_id: row.org_id,
			created_at: new Date(Number(row.created_at) / 1000),
			updated_at: new Date(Number(row.updated_at) / 1000),
		}));
	};

	public static updateOrgInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
		},
	) => {
		const stdb = STDBClient.getInstance();

		// Fetch current state to merge with partial update
		const current = await stdb.queryOne<{
			uuid: string;
			is_accepted: boolean;
		}>(`SELECT * FROM invite_org WHERE uuid = '${invite_id}'`);

		if (!current) {
			throw new Error("no result");
		}

		await stdb.callReducer(
			"update_org_invite",
			[invite_id, data.is_accepted ?? current.is_accepted],
			{ injectRootKey: false },
		);
	};

	public static updateUserInvite = async (
		invite_id: string,
		data: {
			is_accepted?: boolean;
			role_id?: string;
		},
	) => {
		const stdb = STDBClient.getInstance();

		// Fetch current state to merge with partial update
		const current = await stdb.queryOne<{
			uuid: string;
			is_accepted: boolean;
			role_id: string;
		}>(`SELECT * FROM invite_user WHERE uuid = '${invite_id}'`);

		if (!current) {
			throw new Error("no result");
		}

		await stdb.callReducer(
			"update_user_invite",
			[
				invite_id,
				data.is_accepted ?? current.is_accepted,
				data.role_id ?? current.role_id,
			],
			{ injectRootKey: false },
		);
	};

	public static getUserInviteById = async (invite_id: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{
			uuid: string;
			email: string;
			role_id: string;
			invite_token: string;
			is_accepted: boolean;
			org_id: string;
			created_at: number;
			updated_at: number;
		}>(`SELECT * FROM invite_user WHERE uuid = '${invite_id}'`);

		if (!row) {
			throw new Error("no result");
		}

		return {
			id: row.uuid,
			email: row.email,
			role_id: row.role_id,
			invite_token: row.invite_token,
			is_accepted: row.is_accepted,
			org_id: row.org_id,
			created_at: new Date(Number(row.created_at) / 1000),
			updated_at: new Date(Number(row.updated_at) / 1000),
		};
	};
}
