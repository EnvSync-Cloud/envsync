import { rsaLayerDecrypt } from "@/helpers/key-store";
import { AppError, BusinessRuleError, NotFoundError } from "@/libs/errors";

import { VaultEntryService, type VaultMutationOptions } from "./vault_entry.service";

function isAppLayerCiphertext(value: string) {
	return value.startsWith("RSA:") || value.startsWith("HYB:");
}

/** Managed reveal. RSA/HYB values decrypt with the app key. Older rows stored as plaintext stay plaintext. */
export function revealSecretValue(key: string, storedValue: string, privateKey: string): string {
	if (!isAppLayerCiphertext(storedValue)) {
		return storedValue;
	}
	try {
		return rsaLayerDecrypt(storedValue, privateKey);
	} catch {
		throw new BusinessRuleError(
			`Failed to decrypt secret ${key}.`,
			409,
			"SECRET_DECRYPT_FAILED",
		);
	}
}

async function loadManagedPrivateKey(appId: string): Promise<string> {
	try {
		const { AppService } = await import("@/services/app.service");
		return await AppService.getManagedAppPrivateKey(appId);
	} catch (error) {
		if (error instanceof NotFoundError || !(error instanceof AppError)) {
			throw new BusinessRuleError(
				"Cannot reveal secrets for this app because no managed private key is available.",
				409,
				"SECRET_REVEAL_UNAVAILABLE",
			);
		}
		throw error;
	}
}

export class SecretService {
	public static createSecret = async (
		input: {
			key: string;
			value: string;
			env_type_id: string;
			app_id: string;
			org_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => VaultEntryService.create("secret", input, options);

	public static getSecret = async (input: {
		key: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
		user_id: string;
	}) => VaultEntryService.get("secret", input);

	public static updateSecret = async (
		input: {
			key: string;
			value: string;
			app_id: string;
			org_id: string;
			env_type_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => VaultEntryService.update("secret", input, options);

	public static deleteSecret = async (
		input: {
			key: string;
			app_id: string;
			env_type_id: string;
			org_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => VaultEntryService.delete("secret", input, options);

	public static getAllSecret = async (input: {
		app_id: string;
		org_id: string;
		env_type_id: string;
		user_id: string;
	}) => VaultEntryService.list("secret", input);

	// Managed reveal: vault read (clientSideDecrypt false) then rsaLayerDecrypt.
	// A missing vault session or decrypt failure throws; callers must not send ciphertext.
	public static revealManagedSecrets = async (input: {
		app_id: string;
		org_id: string;
		env_type_id: string;
		user_id: string;
		keys?: string[];
	}) => {
		const secrets = await this.getAllSecret({
			app_id: input.app_id,
			org_id: input.org_id,
			env_type_id: input.env_type_id,
			user_id: input.user_id,
		});
		const selected = input.keys
			? secrets.filter(secret => input.keys!.includes(secret.key))
			: secrets;
		if (selected.length === 0) {
			return [];
		}

		await VaultEntryService.requireVaultSession(input.user_id, input.org_id);
		const privateKey = await loadManagedPrivateKey(input.app_id);
		return selected.map(secret => ({
			...secret,
			value: revealSecretValue(secret.key, secret.value, privateKey),
		}));
	};

	public static batchCreateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: Array<{ key: string; value: string }>,
		user_id: string,
		options?: VaultMutationOptions,
	) =>
		VaultEntryService.batchCreate(
			"secret",
			{ org_id, app_id, env_type_id, user_id, entries: envs },
			options,
		);

	public static batchUpdateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: Array<{ key: string; value: string }>,
		user_id: string,
		options?: VaultMutationOptions,
	) =>
		VaultEntryService.batchUpdate(
			"secret",
			{ org_id, app_id, env_type_id, user_id, entries: envs },
			options,
		);

	public static batchDeleteSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
		user_id: string,
		options?: VaultMutationOptions,
	) =>
		VaultEntryService.batchDelete(
			"secret",
			{ org_id, app_id, env_type_id, user_id, keys },
			options,
		);

	public static getAppSecretSummary = async (input: {
		app_id: string;
		org_id: string;
		user_id: string;
	}) => VaultEntryService.getAppSummary("secret", input);
}
