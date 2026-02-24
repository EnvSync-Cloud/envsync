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

		return await db.transaction().execute(async (trx) => {
			const { id } = await trx
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

			const env_list = envs.map(env => ({
				id: uuidv4(),
				key: env.key,
				value: env.value,
				operation: env.operation || "UPDATE",
				env_store_pit_id: id,
				created_at: new Date(),
				updated_at: new Date(),
			}));

			await trx.insertInto("env_store_pit_change_request").values(env_list).execute();

			return { id };
		});
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
	//
	// TODO(perf #56): This method replays ALL change-request rows from epoch up to
	// the target PiT. For long-lived apps this becomes a full-scan of
	// env_store_pit x env_store_pit_change_request. Two mitigations:
	//   1. Add a composite index on env_store_pit(org_id, app_id, env_type_id, created_at)
	//      so the DB can range-scan efficiently.
	//   2. Implement materialized snapshots: periodically persist the full env state
	//      at a known PiT, then only replay changes *after* the snapshot. This
	//      reduces replay from O(total_changes) to O(changes_since_snapshot).
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
	//
	// Perf fix (#57): Previously called getEnvsTillPiTId twice, issuing two
	// independent full-replays from epoch. Since `from` is always <= `to`, the
	// `from` replay is a prefix of the `to` replay. We now fetch all changes up
	// to `to` in a single query and compute both snapshots from one pass.
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
		const db = await DB.getInstance();

		// Fetch timestamps for both PiTs in parallel
		const [fromPiT, toPiT] = await Promise.all([
			db.selectFrom("env_store_pit").select("created_at").where("id", "=", from_pit_id).executeTakeFirstOrThrow(),
			db.selectFrom("env_store_pit").select("created_at").where("id", "=", to_pit_id).executeTakeFirstOrThrow(),
		]);

		// Single query: fetch all changes up to the later PiT (to)
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
			.where("env_store_pit.created_at", "<=", toPiT.created_at)
			.orderBy("env_store_pit.created_at", "asc")
			.orderBy("env_store_pit_change_request.created_at", "asc")
			.execute();

		// Replay changes once, building both snapshots in a single pass
		const fromState = new Map<string, string>();
		const toState = new Map<string, string>();

		for (const change of allChanges) {
			const operation = change.operation || "UPDATE";
			const isBeforeOrAtFrom = change.created_at <= fromPiT.created_at;

			// Apply to the `from` snapshot while we haven't passed the from timestamp
			if (isBeforeOrAtFrom) {
				switch (operation) {
					case "CREATE":
					case "UPDATE":
						fromState.set(change.key, change.value);
						break;
					case "DELETE":
						fromState.delete(change.key);
						break;
				}
			}

			// Always apply to the `to` snapshot
			switch (operation) {
				case "CREATE":
				case "UPDATE":
					toState.set(change.key, change.value);
					break;
				case "DELETE":
					toState.delete(change.key);
					break;
			}
		}

		const diff = {
			added: [] as Array<{ key: string; value: string }>,
			modified: [] as Array<{ key: string; old_value: string; new_value: string }>,
			deleted: [] as Array<{ key: string; value: string }>,
		};

		// Find added and modified
		for (const [key, value] of toState) {
			if (!fromState.has(key)) {
				diff.added.push({ key, value });
			} else if (fromState.get(key) !== value) {
				diff.modified.push({
					key,
					old_value: fromState.get(key)!,
					new_value: value,
				});
			}
		}

		// Find deleted
		for (const [key, value] of fromState) {
			if (!toState.has(key)) {
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
		// Clamp limit to [1, 100] to protect against direct service calls bypassing validation
		limit = Math.min(100, Math.max(1, limit));

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
