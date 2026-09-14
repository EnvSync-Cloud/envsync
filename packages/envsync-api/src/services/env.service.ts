import { VaultEntryService, type VaultMutationOptions } from "./vault_entry.service";

export class EnvService {
	public static createEnv = async (
		input: {
			key: string;
			value: string;
			env_type_id: string;
			app_id: string;
			org_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => {
		const created = await VaultEntryService.create("env", input, options);
		return { id: created.id };
	};

	public static getEnv = async (input: {
		key: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
		user_id: string;
	}) => VaultEntryService.get("env", input);

	public static updateEnv = async (
		input: {
			key: string;
			value: string;
			app_id: string;
			org_id: string;
			env_type_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => {
		await VaultEntryService.update("env", input, options);
	};

	public static deleteEnv = async (
		input: {
			key: string;
			app_id: string;
			env_type_id: string;
			org_id: string;
			user_id: string;
		},
		options?: VaultMutationOptions,
	) => VaultEntryService.delete("env", input, options);

	public static getAllEnv = async (input: {
		app_id: string;
		org_id: string;
		env_type_id: string;
		user_id: string;
	}) => VaultEntryService.list("env", input);

	public static batchCreateEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: Array<{ key: string; value: string }>,
		user_id: string,
		options?: VaultMutationOptions,
	) => {
		await VaultEntryService.batchCreate(
			"env",
			{ org_id, app_id, env_type_id, user_id, entries: envs },
			options,
		);
	};

	public static batchUpdateEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: Array<{ key: string; value: string }>,
		user_id: string,
		options?: VaultMutationOptions,
	) => {
		await VaultEntryService.batchUpdate(
			"env",
			{ org_id, app_id, env_type_id, user_id, entries: envs },
			options,
		);
	};

	public static batchDeleteEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
		user_id: string,
		options?: VaultMutationOptions,
	) =>
		VaultEntryService.batchDelete(
			"env",
			{ org_id, app_id, env_type_id, user_id, keys },
			options,
		);

	public static getAppEnvSummary = async (input: {
		app_id: string;
		org_id: string;
		user_id: string;
	}) => VaultEntryService.getAppSummary("env", input);
}
