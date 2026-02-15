import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { VaultClient } from "@/libs/vault";
import { envScopePath, secretScopePath } from "@/libs/vault/paths";

export class AppService {
	public static createApp = async ({
		name,
		org_id,
		description,
		metadata,
		enable_secrets,
		is_managed_secret = false,
		public_key = null,
		private_key = null,
	}: {
		name: string;
		org_id: string;
		description: string;
		metadata: Record<string, any>;
		enable_secrets: boolean;
		is_managed_secret?: boolean;
		public_key?: string | null;
		private_key?: string | null;
	}) => {
		const db = await DB.getInstance();

		const app = await db
			.insertInto("app")
			.values({
				id: uuidv4(),
				name,
				org_id,
				description,
				metadata,
				created_at: new Date(),
				updated_at: new Date(),
				enable_secrets,
				is_managed_secret,
				public_key,
				private_key,
			})
			.returning([
				"id",
				"name",
				"description",
				"org_id",
				"enable_secrets",
				"is_managed_secret",
				"public_key",
				"metadata",
				"created_at",
				"updated_at",
			])
			.executeTakeFirstOrThrow();

		return app;
	};

	public static getApp = async ({ id }: { id: string }) => {
		const db = await DB.getInstance();

		const app = await db
			.selectFrom("app")
			.select([
				"id",
				"name",
				"description",
				"org_id",
				"enable_secrets",
				"is_managed_secret",
				"public_key",
				"metadata",
				"created_at",
				"updated_at",
			])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return app;
	};

	public static updateApp = async (
		id: string,
		data: {
			name?: string;
			description?: string;
			metadata?: Record<string, any>;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("app")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
	};

	public static deleteApp = async ({ id }: { id: string }) => {
		const db = await DB.getInstance();

		await db.deleteFrom("app").where("id", "=", id).executeTakeFirstOrThrow();
	};

	public static getAllApps = async (org_id: string) => {
		const db = await DB.getInstance();

		const apps = await db
			.selectFrom("app")
			.select([
				"id",
				"name",
				"description",
				"org_id",
				"enable_secrets",
				"is_managed_secret",
				"public_key",
				"metadata",
				"created_at",
				"updated_at",
			])
			.where("org_id", "=", org_id)
			.execute();

		return apps;
	};

	public static getAppEnvTypes = async ({ app_id }: { app_id: string }) => {
		const db = await DB.getInstance();

		const envTypes = await db
			.selectFrom("env_type")
			.selectAll()
			.where("app_id", "=", app_id)
			.execute();

		return envTypes;
	};

	public static getEnvCountByApp = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		if (envTypes.length === 0) return 0;

		const vault = await VaultClient.getInstance();
		const counts = await Promise.all(
			envTypes.map(async et => {
				const keys = await vault.kvList(envScopePath(org_id, app_id, et.id));
				return keys.length;
			}),
		);

		return counts.reduce((sum, c) => sum + c, 0);
	};

	public static getSecretCountByApp = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		if (envTypes.length === 0) return 0;

		const vault = await VaultClient.getInstance();
		const counts = await Promise.all(
			envTypes.map(async et => {
				const keys = await vault.kvList(secretScopePath(org_id, app_id, et.id));
				return keys.length;
			}),
		);

		return counts.reduce((sum, c) => sum + c, 0);
	};

	public static getManagedAppPrivateKey = async (app_id: string) => {
		const db = await DB.getInstance();

		const secret = await db
			.selectFrom("app")
			.select("private_key")
			.where("is_managed_secret", "=", true)
			.where("id", "=", app_id)
			.executeTakeFirst();

		if (!secret) {
			throw new Error("Managed app private key not found");
		}

		return secret.private_key;
	};
}
