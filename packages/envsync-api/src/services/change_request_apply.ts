import { NotFoundError } from "@/libs/errors";
import { EnvService } from "@/services/env.service";
import { EnvStorePiTService } from "@/services/env_store_pit.service";
import { SecretService } from "@/services/secret.service";
import { SecretStorePiTService } from "@/services/secret_store_pit.service";

type ApplyRequest = {
	app_id: string;
	org_id: string;
	target_env_type_id: string;
	message: string;
};

type ApplyItem = {
	key: string;
	operation: string;
	proposed_value: string | null | undefined;
	previous_value?: string | null;
};

function pitValue(item: ApplyItem) {
	return item.operation === "DELETE" ? (item.previous_value ?? "") : (item.proposed_value ?? "");
}

async function applyEnvItem(request: ApplyRequest, item: ApplyItem, user_id: string) {
	const payload = {
		key: item.key,
		value: item.proposed_value ?? "",
		app_id: request.app_id,
		org_id: request.org_id,
		env_type_id: request.target_env_type_id,
		user_id,
	};

	if (item.operation === "CREATE") {
		await EnvService.createEnv(payload, { allowProtected: true });
		return;
	}
	if (item.operation === "UPDATE") {
		try {
			await EnvService.updateEnv(payload, { allowProtected: true });
		} catch (err) {
			if (!(err instanceof NotFoundError)) throw err;
			await EnvService.createEnv(payload, { allowProtected: true });
		}
		return;
	}
	if (item.operation === "DELETE") {
		try {
			await EnvService.deleteEnv(
				{
					key: item.key,
					app_id: request.app_id,
					org_id: request.org_id,
					env_type_id: request.target_env_type_id,
					user_id,
				},
				{ allowProtected: true },
			);
		} catch (err) {
			if (!(err instanceof NotFoundError)) throw err;
		}
	}
}

async function applySecretItem(request: ApplyRequest, item: ApplyItem, user_id: string) {
	const payload = {
		key: item.key,
		value: item.proposed_value ?? "",
		app_id: request.app_id,
		org_id: request.org_id,
		env_type_id: request.target_env_type_id,
		user_id,
	};

	if (item.operation === "CREATE") {
		await SecretService.createSecret(payload, { allowProtected: true });
		return;
	}
	if (item.operation === "UPDATE") {
		try {
			await SecretService.updateSecret(payload, { allowProtected: true });
		} catch (err) {
			if (!(err instanceof NotFoundError)) throw err;
			await SecretService.createSecret(payload, { allowProtected: true });
		}
		return;
	}
	if (item.operation === "DELETE") {
		try {
			await SecretService.deleteSecret(
				{
					key: item.key,
					app_id: request.app_id,
					org_id: request.org_id,
					env_type_id: request.target_env_type_id,
					user_id,
				},
				{ allowProtected: true },
			);
		} catch (err) {
			if (!(err instanceof NotFoundError)) throw err;
		}
	}
}

export async function applyChangeRequestItems({
	request,
	envItems,
	secretItems,
	reviewer_user_id,
}: {
	request: ApplyRequest;
	envItems: ApplyItem[];
	secretItems: ApplyItem[];
	reviewer_user_id: string;
}) {
	for (const item of envItems) {
		await applyEnvItem(request, item, reviewer_user_id);
	}
	for (const item of secretItems) {
		await applySecretItem(request, item, reviewer_user_id);
	}

	if (envItems.length > 0) {
		await EnvStorePiTService.createEnvStorePiT({
			org_id: request.org_id,
			app_id: request.app_id,
			env_type_id: request.target_env_type_id,
			change_request_message: request.message,
			user_id: reviewer_user_id,
			envs: envItems.map((item) => ({
				key: item.key,
				value: pitValue(item),
				operation: item.operation as "CREATE" | "UPDATE" | "DELETE",
			})),
		});
	}
	if (secretItems.length > 0) {
		await SecretStorePiTService.createSecretStorePiT({
			org_id: request.org_id,
			app_id: request.app_id,
			env_type_id: request.target_env_type_id,
			change_request_message: request.message,
			user_id: reviewer_user_id,
			envs: secretItems.map((item) => ({
				key: item.key,
				value: pitValue(item),
				operation: item.operation as "CREATE" | "UPDATE" | "DELETE",
			})),
		});
	}
}
