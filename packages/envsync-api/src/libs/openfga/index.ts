import { OpenFgaClient, type ClientCheckRequest, type ClientReadRequest, type ClientWriteRequest, type TupleKey } from "@openfga/sdk";
import { SpanKind } from "@opentelemetry/api";

import infoLogs, { LogTypes } from "@/libs/logger";
import { withSpan } from "@/libs/telemetry";
import { externalServiceCalls } from "@/libs/telemetry/metrics";
import { config } from "@/utils/env";

import { authorizationModelDef } from "./model";

export class FGAClient {
	private static instance: Promise<FGAClient> | undefined;

	private client!: OpenFgaClient;
	private storeId: string = "";
	private modelId: string = "";

	private constructor() {}

	private static errorMessage(err: unknown): string {
		return err instanceof Error ? err.message : String(err);
	}

	static getInstance(): Promise<FGAClient> {
		this.instance ??= this._getInstance().catch(err => {
			this.instance = undefined;
			throw err;
		});
		return this.instance;
	}

	private static async _getInstance(): Promise<FGAClient> {
		const fga = new FGAClient();
		await fga.init();
		return fga;
	}

	private async init(): Promise<void> {
		const apiUrl = config.OPENFGA_API_URL;

		try {
			// If store ID is pre-configured, use it directly
			if (config.OPENFGA_STORE_ID) {
				this.storeId = config.OPENFGA_STORE_ID;
				this.modelId = config.OPENFGA_MODEL_ID || "";

				this.client = new OpenFgaClient({
					apiUrl,
					storeId: this.storeId,
					authorizationModelId: this.modelId || undefined,
				});

				infoLogs(
					`OpenFGA connected (store=${this.storeId}, model=${this.modelId || "unset"}). ` +
						`Pinned OPENFGA_MODEL_ID is not rewritten on boot; after FGA model changes run \`bun run cli init\` or e2e-setup so org admins pick up can_manage_org_settings.`,
					LogTypes.LOGS,
					"OpenFGA",
				);
				return;
			}

			// Bootstrap: create store and write model
			const bootstrapClient = new OpenFgaClient({ apiUrl });

			// Create store
			const { id: storeId } = await bootstrapClient.createStore({ name: "envsync" });
			if (!storeId) throw new Error("OpenFGA: failed to create store");
			this.storeId = storeId;

			// Write authorization model
			const modelClient = new OpenFgaClient({ apiUrl, storeId: this.storeId });
			const { authorization_model_id: modelId } = await modelClient.writeAuthorizationModel(authorizationModelDef);
			if (!modelId) throw new Error("OpenFGA: failed to write authorization model");
			this.modelId = modelId;

			this.client = new OpenFgaClient({
				apiUrl,
				storeId: this.storeId,
				authorizationModelId: this.modelId,
			});

			infoLogs(
				`OpenFGA bootstrapped (store=${this.storeId}, model=${this.modelId}). ` +
					`Set OPENFGA_STORE_ID=${this.storeId} and OPENFGA_MODEL_ID=${this.modelId} in .env to skip bootstrap next time.`,
				LogTypes.LOGS,
				"OpenFGA",
			);
		} catch (err) {
			infoLogs(`OpenFGA initialization failed: ${FGAClient.errorMessage(err)}`, LogTypes.ERROR, "OpenFGA");
			throw err;
		}
	}

	get store(): string {
		return this.storeId;
	}

	get model(): string {
		return this.modelId;
	}

	/**
	 * Check if a user has a relation to an object.
	 */
	async check(user: string, relation: string, object: string): Promise<boolean> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga check", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
			"fga.relation": relation,
			"fga.object": object,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "check" });
			try {
				const { allowed } = await this.client.check({ user, relation, object });
				const result = allowed ?? false;
				infoLogs(
					`check succeeded user=${user} relation=${relation} object=${object} allowed=${result}`,
					LogTypes.LOGS,
					"OpenFGA",
				);
				return result;
			} catch (err) {
				infoLogs(
					`check failed user=${user} relation=${relation} object=${object}: ${FGAClient.errorMessage(err)}`,
					LogTypes.ERROR,
					"OpenFGA",
				);
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Batch check multiple permission queries using parallel individual checks.
	 */
	async batchCheck(checks: ClientCheckRequest[]): Promise<Map<string, boolean>> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga batchCheck", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
			"fga.batch_size": checks.length,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "batchCheck" });
			try {
				const results = new Map<string, boolean>();

				const responses = await Promise.all(
					checks.map(async c => {
						const { allowed } = await this.client.check(c);
						return { key: `${c.relation}:${c.object}`, allowed: allowed ?? false };
					}),
				);

				for (const r of responses) {
					results.set(r.key, r.allowed);
				}

				infoLogs(`batchCheck succeeded count=${checks.length}`, LogTypes.LOGS, "OpenFGA");
				return results;
			} catch (err) {
				infoLogs(
					`batchCheck failed count=${checks.length}: ${FGAClient.errorMessage(err)}`,
					LogTypes.ERROR,
					"OpenFGA",
				);
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Write relationship tuples (grants).
	 * OpenFGA allows max 10 writes per call; this method handles batching.
	 */
	async writeTuples(tuples: TupleKey[]): Promise<void> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga writeTuples", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
			"fga.batch_size": tuples.length,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "writeTuples" });
			try {
				const BATCH_SIZE = 10;
				for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
					const batch = tuples.slice(i, i + BATCH_SIZE);
					await this.client.write(
						{ writes: batch },
						{ authorizationModelId: this.modelId },
					);
				}
				infoLogs(`writeTuples succeeded count=${tuples.length}`, LogTypes.LOGS, "OpenFGA");
			} catch (err) {
				infoLogs(
					`writeTuples failed count=${tuples.length}: ${FGAClient.errorMessage(err)}`,
					LogTypes.ERROR,
					"OpenFGA",
				);
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Delete relationship tuples (revocations).
	 */
	async deleteTuples(tuples: TupleKey[]): Promise<void> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga deleteTuples", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
			"fga.batch_size": tuples.length,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "deleteTuples" });
			try {
				const BATCH_SIZE = 10;
				for (let i = 0; i < tuples.length; i += BATCH_SIZE) {
					const batch = tuples.slice(i, i + BATCH_SIZE);
					await this.client.write(
						{ deletes: batch },
						{ authorizationModelId: this.modelId },
					);
				}
				infoLogs(`deleteTuples succeeded count=${tuples.length}`, LogTypes.LOGS, "OpenFGA");
			} catch (err) {
				infoLogs(
					`deleteTuples failed count=${tuples.length}: ${FGAClient.errorMessage(err)}`,
					LogTypes.ERROR,
					"OpenFGA",
				);
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Write and delete tuples in a single transaction.
	 */
	async writeTx(req: ClientWriteRequest): Promise<void> {
		try {
			await this.client.write(req, { authorizationModelId: this.modelId });
			infoLogs(
				`writeTx succeeded writes=${req.writes?.length ?? 0} deletes=${req.deletes?.length ?? 0}`,
				LogTypes.LOGS,
				"OpenFGA",
			);
		} catch (err) {
			infoLogs(
				`writeTx failed writes=${req.writes?.length ?? 0} deletes=${req.deletes?.length ?? 0}: ${FGAClient.errorMessage(err)}`,
				LogTypes.ERROR,
				"OpenFGA",
			);
			throw err;
		}
	}

	/**
	 * List all objects of a given type that a user has a relation to.
	 */
	async listObjects(user: string, relation: string, type: string): Promise<string[]> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga listObjects", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
			"fga.relation": relation,
			"fga.object": type,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "listObjects" });
			try {
				const { objects } = await this.client.listObjects({ user, relation, type });
				const result = objects ?? [];
				infoLogs(
					`listObjects succeeded user=${user} relation=${relation} type=${type} count=${result.length}`,
					LogTypes.LOGS,
					"OpenFGA",
				);
				return result;
			} catch (err) {
				infoLogs(
					`listObjects failed user=${user} relation=${relation} type=${type}: ${FGAClient.errorMessage(err)}`,
					LogTypes.ERROR,
					"OpenFGA",
				);
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Read tuples matching a partial tuple key.
	 * Useful for finding all tuples for a user/object.
	 */
	async readTuples(tupleKey: Partial<TupleKey>): Promise<TupleKey[]> {
		const apiUrl = new URL(config.OPENFGA_API_URL);
		return withSpan("openfga readTuples", {
			"rpc.system": "http",
			"peer.service": "openfga",
			"server.address": apiUrl.hostname,
			"server.port": Number(apiUrl.port || (apiUrl.protocol === "https:" ? "443" : "80")),
			"network.peer.address": apiUrl.hostname,
		}, async () => {
			externalServiceCalls.add(1, { "peer.service": "openfga", "rpc.method": "readTuples" });
			try {
				const response = await this.client.read(tupleKey as ClientReadRequest);
				const tuples = (response.tuples ?? []).map(t => t.key as TupleKey);
				infoLogs(`readTuples succeeded count=${tuples.length}`, LogTypes.LOGS, "OpenFGA");
				return tuples;
			} catch (err) {
				infoLogs(`readTuples failed: ${FGAClient.errorMessage(err)}`, LogTypes.ERROR, "OpenFGA");
				throw err;
			}
		}, SpanKind.CLIENT);
	}

	/**
	 * Health check - verify OpenFGA is reachable.
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.client.readAuthorizationModels();
			infoLogs("OpenFGA reachable", LogTypes.LOGS, "OpenFGA");
			return true;
		} catch (err) {
			infoLogs(`OpenFGA unreachable: ${err}`, LogTypes.ERROR, "OpenFGA");
			return false;
		}
	}
}
