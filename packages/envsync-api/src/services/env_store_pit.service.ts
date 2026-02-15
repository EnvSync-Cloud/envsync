import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";

export class EnvStorePiTService {
	public static createEnvStorePiT = async ({
		org_id,
		app_id,
		env_type_id,
		change_request_message,
		user_id,
		envs,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		change_request_message: string;
		user_id: string;
		envs: Array<{
			key: string;
			value: string;
			operation: "CREATE" | "UPDATE" | "DELETE";
		}>;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("env_store_pit")
			.values({
				id: uuidv4(),
				org_id,
				app_id,
				env_type_id,
				change_request_message,
				user_id,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		let env_list = envs.map(env => ({
			id: uuidv4(),
			key: env.key,
			value: env.value,
			operation: env.operation || "UPDATE",
			env_store_pit_id: id,
			created_at: new Date(),
			updated_at: new Date(),
		}));

		// Insert environment variables into env_store_pit_change_request
		await db.insertInto("env_store_pit_change_request").values(env_list).execute();

		return { id };
	};

	public static getEnvStorePiTById = async ({ id }: { id: string }) => {
		const db = await DB.getInstance();

		const pit = await db
			.selectFrom("env_store_pit")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		const envs = await db
			.selectFrom("env_store_pit_change_request")
			.selectAll()
			.where("env_store_pit_id", "=", id)
			.execute();

		return { pit, envs };
	};

	public static getEnvStorePiTs = async ({
		org_id,
		app_id,
		env_type_id,
		page,
		per_page,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		page: number;
		per_page: number;
	}) => {
		const db = await DB.getInstance();

		const [pits, totalCount] = await Promise.all([
			db
				.selectFrom("env_store_pit")
				.selectAll()
				.where("org_id", "=", org_id)
				.where("app_id", "=", app_id)
				.where("env_type_id", "=", env_type_id)
				.orderBy("created_at", "desc")
				.limit(per_page)
				.offset((page - 1) * per_page)
				.execute(),
			db
				.selectFrom("env_store_pit")
				.select(db.fn.count<number>("id").as("count"))
				.where("org_id", "=", org_id)
				.where("app_id", "=", app_id)
				.where("env_type_id", "=", env_type_id)
				.executeTakeFirstOrThrow(),
		]);

		const totalPages = Math.ceil(totalCount.count / per_page);

		return { pits, totalPages };
	};

	public static getEnvStorePiTsByVariable = async ({
		org_id,
		app_id,
		env_type_id,
		key,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		key: string;
	}) => {
		const db = await DB.getInstance();

		const pits = await db
			.selectFrom("env_store_pit")
			.selectAll()
			.innerJoin(
				"env_store_pit_change_request",
				"env_store_pit.id",
				"env_store_pit_change_request.env_store_pit_id",
			)
			.where("env_store_pit.org_id", "=", org_id)
			.where("env_store_pit.app_id", "=", app_id)
			.where("env_store_pit.env_type_id", "=", env_type_id)
			.where("env_store_pit_change_request.key", "=", key)
			.orderBy("env_store_pit.created_at", "desc")
			.execute();

		return pits;
	};

	// Enhanced function to get environment state at a specific point in time
	public static getEnvsTillPiTId = async ({
		org_id,
		app_id,
		env_type_id,
		env_store_pit_id,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		env_store_pit_id: string;
	}) => {
		const db = await DB.getInstance();

		// Get the timestamp of the target PiT
		const targetPiT = await db
			.selectFrom("env_store_pit")
			.select("created_at")
			.where("id", "=", env_store_pit_id)
			.executeTakeFirstOrThrow();

		// Get all PiT changes up to the target timestamp, ordered chronologically
		const allChanges = await db
			.selectFrom("env_store_pit")
			.innerJoin(
				"env_store_pit_change_request",
				"env_store_pit.id",
				"env_store_pit_change_request.env_store_pit_id",
			)
			.select([
				"env_store_pit_change_request.key",
				"env_store_pit_change_request.value",
				"env_store_pit_change_request.operation",
				"env_store_pit.created_at",
			])
			.where("env_store_pit.org_id", "=", org_id)
			.where("env_store_pit.app_id", "=", app_id)
			.where("env_store_pit.env_type_id", "=", env_type_id)
			.where("env_store_pit.created_at", "<=", targetPiT.created_at)
			.orderBy("env_store_pit.created_at", "asc")
			.orderBy("env_store_pit_change_request.created_at", "asc")
			.execute();

		// Replay the changes to build the state at the target point in time
		const envState = new Map<string, { key: string; value: string; last_updated: Date, operation: string }>();

		for (const change of allChanges) {
			const operation = change.operation || "UPDATE";

			switch (operation) {
				case "CREATE":
				case "UPDATE":
					envState.set(change.key, {
						key: change.key,
						value: change.value,
						last_updated: change.created_at,
						operation: change.operation
					});
					break;
				case "DELETE":
					envState.delete(change.key);
					break;
			}
		}

		// Convert Map to array
		return Array.from(envState.values());
	};

	// Get environment state at a specific timestamp
	public static getEnvsTillTimestamp = async ({
		org_id,
		app_id,
		env_type_id,
		timestamp,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		timestamp: Date;
	}) => {
		const db = await DB.getInstance();

		// Get all PiT changes up to the target timestamp
		const allChanges = await db
			.selectFrom("env_store_pit")
			.innerJoin(
				"env_store_pit_change_request",
				"env_store_pit.id",
				"env_store_pit_change_request.env_store_pit_id",
			)
			.select([
				"env_store_pit_change_request.key",
				"env_store_pit_change_request.value",
				"env_store_pit_change_request.operation",
				"env_store_pit.created_at",
			])
			.where("env_store_pit.org_id", "=", org_id)
			.where("env_store_pit.app_id", "=", app_id)
			.where("env_store_pit.env_type_id", "=", env_type_id)
			.where("env_store_pit.created_at", "<=", timestamp)
			.orderBy("env_store_pit.created_at", "asc")
			.execute();

		// Replay changes to build state
		const envState = new Map<string, { key: string; value: string; last_updated: Date, operation: string }>();

		for (const change of allChanges) {
			const operation = change.operation || "UPDATE";

			switch (operation) {
				case "CREATE":
				case "UPDATE":
					envState.set(change.key, {
						key: change.key,
						value: change.value,
						last_updated: change.created_at,
						operation: change.operation
					});
					break;
				case "DELETE":
					envState.delete(change.key);
					break;
			}
		}

		return Array.from(envState.values());
	};

	// Get the difference between two points in time
	public static getEnvDiff = async ({
		org_id,
		app_id,
		env_type_id,
		from_pit_id,
		to_pit_id,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		from_pit_id: string;
		to_pit_id: string;
	}) => {
		const [fromState, toState] = await Promise.all([
			this.getEnvsTillPiTId({ org_id, app_id, env_type_id, env_store_pit_id: from_pit_id }),
			this.getEnvsTillPiTId({ org_id, app_id, env_type_id, env_store_pit_id: to_pit_id }),
		]);

		const fromMap = new Map(fromState.map(env => [env.key, env.value]));
		const toMap = new Map(toState.map(env => [env.key, env.value]));

		const diff = {
			added: [] as Array<{ key: string; value: string }>,
			modified: [] as Array<{ key: string; old_value: string; new_value: string }>,
			deleted: [] as Array<{ key: string; value: string }>,
		};

		// Find added and modified
		for (const [key, value] of toMap) {
			if (!fromMap.has(key)) {
				diff.added.push({ key, value });
			} else if (fromMap.get(key) !== value) {
				diff.modified.push({
					key,
					old_value: fromMap.get(key)!,
					new_value: value,
				});
			}
		}

		// Find deleted
		for (const [key, value] of fromMap) {
			if (!toMap.has(key)) {
				diff.deleted.push({ key, value });
			}
		}

		return diff;
	};

	// Get timeline of changes for a specific variable
	public static getVariableTimeline = async ({
		org_id,
		app_id,
		env_type_id,
		key,
		limit = 50,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		key: string;
		limit?: number;
	}) => {
		const db = await DB.getInstance();

		const timeline = await db
			.selectFrom("env_store_pit")
			.innerJoin(
				"env_store_pit_change_request",
				"env_store_pit.id",
				"env_store_pit_change_request.env_store_pit_id",
			)
			.select([
				"env_store_pit.id as pit_id",
				"env_store_pit.change_request_message",
				"env_store_pit.user_id",
				"env_store_pit.created_at",
				"env_store_pit_change_request.value",
				"env_store_pit_change_request.operation",
			])
			.where("env_store_pit.org_id", "=", org_id)
			.where("env_store_pit.app_id", "=", app_id)
			.where("env_store_pit.env_type_id", "=", env_type_id)
			.where("env_store_pit_change_request.key", "=", key)
			.orderBy("env_store_pit.created_at", "desc")
			.limit(limit)
			.execute();

		return timeline;
	};
}
