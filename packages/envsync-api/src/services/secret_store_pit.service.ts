import { STDBClient } from "@/libs/stdb";

interface SecretStorePitRow {
	uuid: string;
	org_id: string;
	app_id: string;
	env_type_id: string;
	change_request_message: string;
	user_id: string;
	changes: string;
	created_at: string;
	updated_at: string;
}

function mapPitRow(row: SecretStorePitRow) {
	return {
		id: row.uuid,
		org_id: row.org_id,
		app_id: row.app_id,
		env_type_id: row.env_type_id,
		change_request_message: row.change_request_message,
		user_id: row.user_id,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

function parseChanges(row: SecretStorePitRow): Array<{
	id: string;
	key: string;
	value: string;
	operation: string;
	secret_store_pit_id: string;
	created_at: Date;
	updated_at: Date;
}> {
	const changes: Array<{ key: string; value: string; operation: string }> =
		typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes;
	return changes.map((c) => ({
		id: crypto.randomUUID(),
		key: c.key,
		value: c.value,
		operation: c.operation || "UPDATE",
		secret_store_pit_id: row.uuid,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	}));
}

export class SecretStorePiTService {
	public static createSecretStorePiT = async ({
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
		const stdb = STDBClient.getInstance();
		const id = crypto.randomUUID();

		await stdb.callReducer("create_secret_pit", [
			id,
			org_id,
			app_id,
			env_type_id,
			change_request_message,
			user_id,
			JSON.stringify(envs),
		]);

		return { id };
	};

	public static getSecretStorePiTById = async ({ id }: { id: string }) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE uuid = '${id}'`,
		);

		if (!row) {
			throw new Error(`SecretStorePiT not found: ${id}`);
		}

		const pit = mapPitRow(row);
		const envs = parseChanges(row);

		return { pit, envs };
	};

	public static getSecretStorePiTs = async ({
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
		const stdb = STDBClient.getInstance();
		const offset = (page - 1) * per_page;

		const whereClause = `org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}'`;

		const [rows, totalCount] = await Promise.all([
			stdb.query<SecretStorePitRow>(
				`SELECT * FROM secret_store_pit WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${per_page} OFFSET ${offset}`,
			),
			stdb.queryCount(
				`SELECT uuid FROM secret_store_pit WHERE ${whereClause}`,
			),
		]);

		const pits = rows.map(mapPitRow);
		const totalPages = Math.ceil(totalCount / per_page);

		return { pits, totalPages };
	};

	public static getSecretStorePiTsByVariable = async ({
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
		const stdb = STDBClient.getInstance();

		// Query all PiTs for the scope, then filter by key in the changes JSON in TypeScript
		const rows = await stdb.query<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}' ORDER BY created_at DESC`,
		);

		const pits = rows
			.filter((row) => {
				const changes: Array<{ key: string }> =
					typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes;
				return changes.some((c) => c.key === key);
			})
			.map(mapPitRow);

		return pits;
	};

	// Get environment state at a specific point in time
	public static getEnvsTillPiTId = async ({
		org_id,
		app_id,
		env_type_id,
		secret_store_pit_id,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		secret_store_pit_id: string;
	}) => {
		const stdb = STDBClient.getInstance();

		// Get the timestamp of the target PiT
		const targetPiT = await stdb.queryOne<{ created_at: string }>(
			`SELECT created_at FROM secret_store_pit WHERE uuid = '${secret_store_pit_id}'`,
		);

		if (!targetPiT) {
			throw new Error(`SecretStorePiT not found: ${secret_store_pit_id}`);
		}

		// Get all PiT entries up to the target timestamp, ordered chronologically
		const allPits = await stdb.query<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}' AND created_at <= '${targetPiT.created_at}' ORDER BY created_at ASC`,
		);

		// Replay the changes to build the state at the target point in time
		const envState = new Map<
			string,
			{ key: string; value: string; last_updated: Date }
		>();

		for (const pit of allPits) {
			const changes: Array<{ key: string; value: string; operation: string }> =
				typeof pit.changes === "string" ? JSON.parse(pit.changes) : pit.changes;

			for (const change of changes) {
				const operation = change.operation || "UPDATE";

				switch (operation) {
					case "CREATE":
					case "UPDATE":
						envState.set(change.key, {
							key: change.key,
							value: change.value,
							last_updated: new Date(pit.created_at),
						});
						break;
					case "DELETE":
						envState.delete(change.key);
						break;
				}
			}
		}

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
		const stdb = STDBClient.getInstance();

		// Get all PiT entries up to the target timestamp
		const allPits = await stdb.query<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}' AND created_at <= '${timestamp.toISOString()}' ORDER BY created_at ASC`,
		);

		// Replay changes to build state
		const envState = new Map<
			string,
			{ key: string; value: string; last_updated: Date }
		>();

		for (const pit of allPits) {
			const changes: Array<{ key: string; value: string; operation: string }> =
				typeof pit.changes === "string" ? JSON.parse(pit.changes) : pit.changes;

			for (const change of changes) {
				const operation = change.operation || "UPDATE";

				switch (operation) {
					case "CREATE":
					case "UPDATE":
						envState.set(change.key, {
							key: change.key,
							value: change.value,
							last_updated: new Date(pit.created_at),
						});
						break;
					case "DELETE":
						envState.delete(change.key);
						break;
				}
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
		const stdb = STDBClient.getInstance();

		// Fetch timestamps for both PiTs in parallel
		const [fromPiT, toPiT] = await Promise.all([
			stdb.queryOne<{ created_at: string }>(`SELECT created_at FROM secret_store_pit WHERE uuid = '${from_pit_id}'`),
			stdb.queryOne<{ created_at: string }>(`SELECT created_at FROM secret_store_pit WHERE uuid = '${to_pit_id}'`),
		]);

		if (!fromPiT || !toPiT) {
			throw new Error("One or both PiT IDs not found");
		}

		// Single query: fetch all PiTs up to the later PiT (to)
		const allPits = await stdb.query<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}' AND created_at <= '${toPiT.created_at}' ORDER BY created_at ASC`,
		);

		// Replay changes once, building both snapshots in a single pass
		const fromState = new Map<string, string>();
		const toState = new Map<string, string>();

		for (const pit of allPits) {
			const changes: Array<{ key: string; value: string; operation: string }> =
				typeof pit.changes === "string" ? JSON.parse(pit.changes) : pit.changes;
			const isBeforeOrAtFrom = pit.created_at <= fromPiT.created_at;

			for (const change of changes) {
				const operation = change.operation || "UPDATE";

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

		const stdb = STDBClient.getInstance();

		// Fetch PiTs for this scope, then filter by key in TypeScript
		const rows = await stdb.query<SecretStorePitRow>(
			`SELECT * FROM secret_store_pit WHERE org_id = '${org_id}' AND app_id = '${app_id}' AND env_type_id = '${env_type_id}' ORDER BY created_at DESC`,
		);

		const timeline: Array<{
			pit_id: string;
			change_request_message: string;
			user_id: string;
			created_at: Date;
			value: string;
			operation: string;
		}> = [];

		for (const row of rows) {
			if (timeline.length >= limit) break;

			const changes: Array<{ key: string; value: string; operation: string }> =
				typeof row.changes === "string" ? JSON.parse(row.changes) : row.changes;

			const matchingChange = changes.find((c) => c.key === key);
			if (matchingChange) {
				timeline.push({
					pit_id: row.uuid,
					change_request_message: row.change_request_message,
					user_id: row.user_id,
					created_at: new Date(row.created_at),
					value: matchingChange.value,
					operation: matchingChange.operation || "UPDATE",
				});
			}
		}

		return timeline;
	};
}
