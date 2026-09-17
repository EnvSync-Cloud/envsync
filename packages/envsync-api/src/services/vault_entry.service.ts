import { DB } from "@/libs/db";
import { BusinessRuleError, ConflictError, ForbiddenError, NotFoundError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";
import { variableOperations } from "@/libs/telemetry/metrics";
import { KMSClient } from "@/libs/kms/client";
import { getVaultSessionToken } from "@/libs/kms/session-manager";

import { AuthorizationService } from "./authorization.service";
import { EnvStorePiTService } from "./env_store_pit.service";
import { EnvTypeService } from "./env_type.service";
import { KeyValidationService } from "./key_validation.service";
import { SecretStorePiTService } from "./secret_store_pit.service";

export type VaultEntryType = "env" | "secret";

export type VaultMutationOptions = {
	allowProtected?: boolean;
};

type VaultKeyInput = {
	key: string;
	value: string;
	env_type_id: string;
	app_id: string;
	org_id: string;
	user_id: string;
};

function pLimit(concurrency: number) {
	let active = 0;
	const queue: (() => void)[] = [];
	const next = () => {
		if (queue.length > 0 && active < concurrency) {
			active++;
			queue.shift()!();
		}
	};
	return <T>(fn: () => Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const run = () =>
				fn()
					.then(resolve, reject)
					.finally(() => {
						active--;
						next();
					});
			queue.push(run);
			next();
		});
}

const limit = pLimit(10);

function toRecord(
	org_id: string,
	app_id: string,
	env_type_id: string,
	key: string,
	value: string,
	created_at: string,
) {
	return {
		id: `${org_id}:${app_id}:${env_type_id}:${key}`,
		org_id,
		app_id,
		env_type_id,
		key,
		value,
		created_at: created_at ? new Date(Number(created_at) * 1000) : new Date(),
		updated_at: created_at ? new Date(Number(created_at) * 1000) : new Date(),
	};
}

function isVaultNotFound(err: unknown) {
	return err instanceof Error && "code" in err && (err as { code?: number }).code === 5;
}

function excludeTable(entryType: VaultEntryType) {
	return entryType === "env" ? "env_store" : "secret_store";
}

function resourceName(entryType: VaultEntryType) {
	return entryType === "env" ? "Env" : "Secret";
}

export class VaultEntryService {
	public static assertMutableEnvType = async ({
		env_type_id,
		org_id,
		app_id,
		user_id,
		allowProtected = false,
	}: {
		env_type_id: string;
		org_id: string;
		app_id?: string;
		user_id: string;
		allowProtected?: boolean;
	}) => {
		const envType = await EnvTypeService.getEnvType(env_type_id);
		if (envType.org_id !== org_id) {
			throw new ForbiddenError("Environment type does not belong to this organization.");
		}
		if (app_id && envType.app_id !== app_id) {
			throw new ForbiddenError("Environment type does not belong to this application.");
		}

		const canEdit = await AuthorizationService.check(
			user_id,
			envType.is_protected ? "can_manage_protected" : "can_edit",
			"env_type",
			env_type_id,
		);
		if (!canEdit) {
			throw new ForbiddenError("You do not have permission to perform this action.");
		}
		if (envType.is_protected && !allowProtected) {
			throw new BusinessRuleError(
				"Protected environments require a change request.",
				409,
				"PROTECTED_ENV_REQUIRES_CHANGE_REQUEST",
			);
		}
		return envType;
	};

	public static create = async (
		entryType: VaultEntryType,
		input: VaultKeyInput,
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});
		if (entryType === "secret") {
			const { AppService } = await import("@/services/app.service");
			const { PlanLimitService } = await import("@/services/plan_limit.service");
			const app = await AppService.getApp({ id: input.app_id });
			if (!app.is_managed_secret) {
				await PlanLimitService.assertFeature(input.org_id, "byok_secrets");
			}
		}

		const keyCheck = await KeyValidationService.checkKeyExists({
			key: input.key,
			app_id: input.app_id,
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			user_id: input.user_id,
			excludeTable: excludeTable(entryType),
		});
		if (keyCheck.exists) {
			throw new ConflictError(keyCheck.message!);
		}

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		const result = await kms.vaultWrite(
			{
				orgId: input.org_id,
				scopeId: input.app_id,
				entryType,
				key: input.key,
				envTypeId: input.env_type_id,
				value: Buffer.from(input.value, "utf-8"),
				createdBy: input.user_id,
			},
			sessionToken,
		);
		if (entryType === "env") {
			variableOperations.add(1, { operation: "created" });
		}
		return {
			id: `${input.org_id}:${input.app_id}:${input.env_type_id}:${input.key}`,
			vault_version: result.version,
		};
	};

	public static get = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "value">,
	) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		try {
			const result = await kms.vaultRead(
				{
					orgId: input.org_id,
					scopeId: input.app_id,
					entryType,
					key: input.key,
					envTypeId: input.env_type_id,
					clientSideDecrypt: false,
				},
				sessionToken,
			);
			return toRecord(
				input.org_id,
				input.app_id,
				input.env_type_id,
				input.key,
				result.encryptedValue.toString("utf-8"),
				result.createdAt,
			);
		} catch (err) {
			if (isVaultNotFound(err)) {
				return undefined;
			}
			throw err;
		}
	};

	public static update = async (
		entryType: VaultEntryType,
		input: VaultKeyInput,
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		try {
			await kms.vaultRead(
				{
					orgId: input.org_id,
					scopeId: input.app_id,
					entryType,
					key: input.key,
					envTypeId: input.env_type_id,
				},
				sessionToken,
			);
		} catch (err) {
			if (isVaultNotFound(err)) {
				throw new NotFoundError(resourceName(entryType), input.key);
			}
			throw err;
		}

		const result = await kms.vaultWrite(
			{
				orgId: input.org_id,
				scopeId: input.app_id,
				entryType,
				key: input.key,
				envTypeId: input.env_type_id,
				value: Buffer.from(input.value, "utf-8"),
				createdBy: input.user_id,
			},
			sessionToken,
		);
		return { vault_version: result.version };
	};

	public static delete = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "value">,
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		try {
			await kms.vaultRead(
				{
					orgId: input.org_id,
					scopeId: input.app_id,
					entryType,
					key: input.key,
					envTypeId: input.env_type_id,
				},
				sessionToken,
			);
		} catch (err) {
			if (isVaultNotFound(err)) {
				throw new NotFoundError(resourceName(entryType), input.key);
			}
			throw err;
		}

		await kms.vaultDelete(
			input.org_id,
			input.app_id,
			entryType,
			input.key,
			input.env_type_id,
			sessionToken,
		);
	};

	public static list = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "key" | "value">,
	) => {
		const candidates =
			entryType === "env"
				? await EnvStorePiTService.getCurrentEnvState({
						org_id: input.org_id,
						app_id: input.app_id,
						env_type_id: input.env_type_id,
					})
				: await SecretStorePiTService.getCurrentSecretState({
						org_id: input.org_id,
						app_id: input.app_id,
						env_type_id: input.env_type_id,
					});
		if (candidates.length === 0) {
			return [];
		}

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		const results = await Promise.all(
			candidates.map(candidate =>
				limit(async () => {
					try {
						const result = await kms.vaultRead(
							{
								orgId: input.org_id,
								scopeId: input.app_id,
								entryType,
								key: candidate.key,
								envTypeId: input.env_type_id,
								clientSideDecrypt: false,
							},
							sessionToken,
						);
						return toRecord(
							input.org_id,
							input.app_id,
							input.env_type_id,
							candidate.key,
							result.encryptedValue.toString("utf-8"),
							result.createdAt,
						);
					} catch (error) {
						if (isVaultNotFound(error)) {
							infoLogs(
								`Vault list mismatch for ${entryType} ${candidate.key} in ${input.app_id}/${input.env_type_id}; dropping stale PiT key`,
								LogTypes.LOGS,
								"VaultEntryService",
							);
						}
						return null;
					}
				}),
			),
		);

		return results
			.filter((row): row is NonNullable<typeof row> => row !== null)
			.sort((left, right) => left.key.localeCompare(right.key));
	};

	public static batchCreate = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "key" | "value"> & { entries: Array<{ key: string; value: string }> },
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});

		const conflicts = await KeyValidationService.validateKeys({
			keys: input.entries.map(entry => entry.key),
			app_id: input.app_id,
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			user_id: input.user_id,
			excludeTable: excludeTable(entryType),
		});
		if (conflicts.length > 0) {
			throw new ConflictError(`Key conflicts found: ${conflicts.map(item => item.message).join(", ")}`);
		}

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		const results = await Promise.all(
			input.entries.map(entry =>
				limit(async () => {
					const result = await kms.vaultWrite(
						{
							orgId: input.org_id,
							scopeId: input.app_id,
							entryType,
							key: entry.key,
							envTypeId: input.env_type_id,
							value: Buffer.from(entry.value, "utf-8"),
							createdBy: input.user_id,
						},
						sessionToken,
					);
					return { key: entry.key, vault_version: result.version };
				}),
			),
		);
		if (entryType === "env") {
			variableOperations.add(input.entries.length, { operation: "created" });
		}
		return results;
	};

	public static batchUpdate = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "key" | "value"> & { entries: Array<{ key: string; value: string }> },
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		return Promise.all(
			input.entries.map(entry =>
				limit(async () => {
					const result = await kms.vaultWrite(
						{
							orgId: input.org_id,
							scopeId: input.app_id,
							entryType,
							key: entry.key,
							envTypeId: input.env_type_id,
							value: Buffer.from(entry.value, "utf-8"),
							createdBy: input.user_id,
						},
						sessionToken,
					);
					return { key: entry.key, vault_version: result.version };
				}),
			),
		);
	};

	public static batchDelete = async (
		entryType: VaultEntryType,
		input: Omit<VaultKeyInput, "key" | "value"> & { keys: string[] },
		options?: VaultMutationOptions,
	) => {
		await this.assertMutableEnvType({
			env_type_id: input.env_type_id,
			org_id: input.org_id,
			app_id: input.app_id,
			user_id: input.user_id,
			allowProtected: options?.allowProtected,
		});

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		await Promise.all(
			input.keys.map(key =>
				limit(() =>
					kms.vaultDelete(input.org_id, input.app_id, entryType, key, input.env_type_id, sessionToken),
				),
			),
		);
	};

	public static getAppSummary = async (
		entryType: VaultEntryType,
		input: { app_id: string; org_id: string; user_id: string },
	) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", input.app_id)
			.where("org_id", "=", input.org_id)
			.execute();

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(input.user_id, input.org_id);
		return Promise.all(
			envTypes.map(async envType => {
				const entries = await kms.vaultList(
					input.org_id,
					input.app_id,
					entryType,
					envType.id,
					sessionToken,
				);
				return { env_type_id: envType.id, count: entries.length };
			}),
		);
	};
}
