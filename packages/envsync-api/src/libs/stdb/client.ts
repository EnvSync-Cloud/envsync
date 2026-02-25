import { SpanKind } from "@opentelemetry/api";

import infoLogs, { LogTypes } from "@/libs/logger";
import { withSpan } from "@/libs/telemetry";
import { externalServiceCalls } from "@/libs/telemetry/metrics";
import { config } from "@/utils/env";

import { STDBConnectionError, STDBReducerError, STDBTimeoutError } from "./errors";

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
/** Refresh the token this many seconds before it actually expires. */
const TOKEN_REFRESH_BUFFER_S = 30;

export class STDBClient {
	private static instance: STDBClient | undefined;

	private readonly url: string;
	private readonly dbName: string;
	private readonly staticAuthToken: string;
	private readonly rootKeyHex: string;
	private readonly tokenUrl: string | undefined;
	private readonly tokenClientId: string | undefined;
	private readonly tokenClientSecret: string | undefined;

	/** Cached client-credentials token + wall-clock expiry. */
	private cachedToken: string | null = null;
	private tokenExpiresAt = 0;
	/** Mutex so concurrent requests don't all refresh at once. */
	private refreshPromise: Promise<string> | null = null;

	private constructor() {
		this.url = config.STDB_URL.replace(/\/$/, "");
		this.dbName = config.STDB_DB_NAME;
		this.staticAuthToken = config.STDB_AUTH_TOKEN || "";
		this.rootKeyHex = config.STDB_ROOT_KEY;
		this.tokenUrl = config.STDB_TOKEN_URL;
		this.tokenClientId = config.STDB_TOKEN_CLIENT_ID;
		this.tokenClientSecret = config.STDB_TOKEN_CLIENT_SECRET;
	}

	static getInstance(): STDBClient {
		this.instance ??= new STDBClient();
		return this.instance;
	}

	private get useClientCredentials(): boolean {
		return !!(this.tokenUrl && this.tokenClientId && this.tokenClientSecret);
	}

	/**
	 * Fetch a fresh access token via the client-credentials grant.
	 * Caches the result and refreshes it TOKEN_REFRESH_BUFFER_S before expiry.
	 */
	private async getAuthToken(): Promise<string> {
		const now = Date.now() / 1000;
		if (this.cachedToken && now < this.tokenExpiresAt) {
			return this.cachedToken;
		}

		// Coalesce concurrent refresh attempts
		if (this.refreshPromise) return this.refreshPromise;

		this.refreshPromise = (async () => {
			try {
				const res = await fetch(this.tokenUrl!, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						grant_type: "client_credentials",
						client_id: this.tokenClientId,
						client_secret: this.tokenClientSecret,
					}),
					signal: AbortSignal.timeout(TIMEOUT_MS),
				});

				if (!res.ok) {
					throw new Error(`Failed to get auth token: ${res.status} ${res.statusText}`);
				}

				const data = (await res.json()) as {
					access_token: string;
					expires_in: number;
				};

				this.cachedToken = data.access_token;
				this.tokenExpiresAt = Date.now() / 1000 + data.expires_in - TOKEN_REFRESH_BUFFER_S;

				infoLogs(
					`STDB token refreshed, expires in ${data.expires_in}s`,
					LogTypes.LOGS,
					"STDB",
				);

				return data.access_token;
			} finally {
				this.refreshPromise = null;
			}
		})();

		return this.refreshPromise;
	}

	private async headers(): Promise<Record<string, string>> {
		const h: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.useClientCredentials) {
			h["Authorization"] = `Bearer ${await this.getAuthToken()}`;
		} else if (this.staticAuthToken) {
			h["Authorization"] = `Bearer ${this.staticAuthToken}`;
		}
		return h;
	}

	/**
	 * Call a SpaceTimeDB reducer (mutation).
	 * Automatically injects root_key_hex as the first argument for reducers that need it.
	 */
	async callReducer<T = unknown>(
		reducer: string,
		args: unknown[],
		options?: { injectRootKey?: boolean },
	): Promise<T> {
		const finalArgs = options?.injectRootKey !== false
			? [this.rootKeyHex, ...args]
			: args;

		return withSpan(
			`stdb call ${reducer}`,
			{
				"stdb.reducer": reducer,
				"peer.service": "spacetimedb",
			},
			async (span) => {
				externalServiceCalls.add(1, { "peer.service": "spacetimedb", "stdb.reducer": reducer });

				let lastError: Error | null = null;

				for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
					try {
						const res = await fetch(
							`${this.url}/v1/database/${this.dbName}/call/${reducer}`,
							{
								method: "POST",
								headers: await this.headers(),
								body: JSON.stringify(finalArgs),
								signal: AbortSignal.timeout(TIMEOUT_MS),
							},
						);

						if (!res.ok) {
							const body = await res.text();
							// Don't retry on 4xx (client errors like "already exists")
							if (res.status >= 400 && res.status < 500) {
								throw new STDBReducerError(reducer, body);
							}
							lastError = new STDBReducerError(reducer, `HTTP ${res.status}: ${body}`);
							continue;
						}

						const text = await res.text();
						if (!text) return undefined as T;

						try {
							return JSON.parse(text) as T;
						} catch {
							// Some reducers return plain strings
							return text as T;
						}
					} catch (err) {
						if (err instanceof STDBReducerError) throw err;
						if (err instanceof DOMException && err.name === "AbortError") {
							lastError = new STDBTimeoutError(reducer, TIMEOUT_MS);
							continue;
						}
						lastError = err instanceof Error ? err : new Error(String(err));
					}
				}

				throw lastError ?? new STDBConnectionError("All retries exhausted");
			},
			SpanKind.CLIENT,
		);
	}

	/**
	 * Call a reducer that returns data via the reducer_response table.
	 * Generates a request_id, calls the reducer, queries the response, then cleans up.
	 * The request_id is injected as the first arg (before root_key_hex).
	 */
	async callReducerWithResponse<T = unknown>(
		reducer: string,
		args: unknown[],
		options?: { injectRootKey?: boolean },
	): Promise<T> {
		const requestId = crypto.randomUUID();

		// For response reducers: args are [request_id, root_key_hex, ...rest]
		const finalArgs = options?.injectRootKey !== false
			? [requestId, this.rootKeyHex, ...args]
			: [requestId, ...args];

		// Step 1: Call the reducer with pre-built args (writes result to reducer_response table)
		await this.callReducer<void>(reducer, finalArgs, { injectRootKey: false });

		// Step 2: Query the response table
		const rows = await this.query<{ data: string }>(
			`SELECT data FROM reducer_response WHERE request_id = '${requestId}'`,
		);

		// Step 3: Clean up the response row
		this.callReducer<void>("cleanup_response", [requestId], { injectRootKey: false }).catch(() => {});

		if (!rows.length) {
			throw new STDBReducerError(reducer, "No response found in reducer_response table");
		}

		const data = rows[0].data;
		try {
			return JSON.parse(data) as T;
		} catch {
			return data as T;
		}
	}

	/**
	 * Execute a SQL query against SpaceTimeDB (for reads).
	 */
	async query<T = unknown>(sql: string): Promise<T[]> {
		return withSpan(
			"stdb sql",
			{
				"stdb.sql": sql.substring(0, 200),
				"peer.service": "spacetimedb",
			},
			async (span) => {
				externalServiceCalls.add(1, { "peer.service": "spacetimedb", "stdb.operation": "sql" });

				const res = await fetch(
					`${this.url}/v1/database/${this.dbName}/sql`,
					{
						method: "POST",
						headers: await this.headers(),
						body: sql,
						signal: AbortSignal.timeout(TIMEOUT_MS),
					},
				);

				// Print Raw CURL URL
				infoLogs(`Raw CURL URL: curl -X POST "${this.url}/v1/database/${this.dbName}/sql" -H "Content-Type: application/json" -d '${sql}'`, LogTypes.LOGS, "STDB");

				if (!res.ok) {
					const body = await res.text();
					throw new STDBConnectionError(`SQL query failed (${res.status}): ${body}`);
				}

				const json = await res.json();
				span.setAttribute("stdb.row_count", Array.isArray(json) ? json.length : 0);
				return (Array.isArray(json) ? json : []) as T[];
			},
			SpanKind.CLIENT,
		);
	}

	/**
	 * Health check — ping SpaceTimeDB.
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const headers = await this.headers();
			infoLogs(`Headers: ${JSON.stringify(headers)}`, LogTypes.LOGS, "STDB");
			const res = await fetch(`${this.url}/v1/ping`, {
				method: "GET",
				signal: AbortSignal.timeout(5_000),
				headers,
			});
			const ok = res.ok;
			if (ok) {
				infoLogs("SpaceTimeDB reachable", LogTypes.LOGS, "STDB");
			} else {
				infoLogs(`SpaceTimeDB health check returned ${res.status}`, LogTypes.ERROR, "STDB");
			}
			return ok;
		} catch (err) {
			infoLogs(`Error: ${JSON.stringify(err)}`, LogTypes.ERROR, "STDB");
			infoLogs(`SpaceTimeDB unreachable: ${err}`, LogTypes.ERROR, "STDB");
			return false;
		}
	}

	/**
	 * Get the root key hex (for reducers that need it injected by the client manually).
	 */
	getRootKeyHex(): string {
		return this.rootKeyHex;
	}

	// ─── Query Helpers ────────────────────────────────────────────────

	/**
	 * Paginated query helper — wraps STDB SQL with LIMIT/OFFSET.
	 */
	async queryPaginated<T = unknown>(
		sql: string,
		limit: number,
		offset: number,
	): Promise<T[]> {
		return this.query<T>(`${sql} LIMIT ${limit} OFFSET ${offset}`);
	}

	/**
	 * Single-row query helper — returns the first row or null.
	 */
	async queryOne<T = unknown>(sql: string): Promise<T | null> {
		const rows = await this.query<T>(sql);
		return rows.length > 0 ? rows[0] : null;
	}

	/**
	 * Count query helper — returns the count.
	 */
	async queryCount(sql: string): Promise<number> {
		const rows = await this.query<{ count: number }>(
			`SELECT COUNT(*) as count FROM (${sql})`,
		);
		return rows.length > 0 ? Number(rows[0].count) : 0;
	}
}
