import { VaultEntryService, type VaultMutationOptions } from "./vault_entry.service";

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
