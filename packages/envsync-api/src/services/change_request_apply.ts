import { BusinessRuleError, NotFoundError } from "@/libs/errors";
import { openChangeRequestValues } from "@/services/change_request_crypto";
import { EnvService } from "@/services/env.service";
import { EnvStorePiTService } from "@/services/env_store_pit.service";
import { SecretService } from "@/services/secret.service";
import { SecretStorePiTService } from "@/services/secret_store_pit.service";

type ApplyRequest = {
	id: string;
	app_id: string;
	org_id: string;
	target_env_type_id: string;
	message: string;
	request_kind?: string;
	requested_by_user_id?: string;
};

type ApplyItem = {
	id?: string;
	key: string;
	operation: string;
	proposed_value: string | null | undefined;
	previous_value?: string | null;
};

async function openApplyItem(request: ApplyRequest, item: ApplyItem): Promise<ApplyItem> {
	if (!item.id) {
		throw new BusinessRuleError(
			"Change request value could not be decrypted.",
			500,
			"CHANGE_REQUEST_VALUE_UNREADABLE",
		);
	}
	const opened = await openChangeRequestValues(
		{
			orgId: request.org_id,
			appId: request.app_id,
			changeRequestId: request.id,
			itemId: item.id,
		},
		{
			previous: item.previous_value,
			proposed: item.proposed_value,
		},
	);
	return {
		...item,
		previous_value: opened.previous_value,
		proposed_value: opened.proposed_value,
	};
}

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
	if (request.request_kind === "certificate") {
		const { CertificateService } = await import("@/services/certificate.service");
		const body = JSON.parse(request.message || "{}") as {
			operation?: string;
			payload?: Record<string, unknown>;
		};
		const payload = body.payload ?? {};
		if (body.operation === "ISSUE_LEAF") {
			await CertificateService.issueLeaf({
				org_id: request.org_id,
				app_id: String(payload.app_id ?? request.app_id),
				env_type_id: typeof payload.env_type_id === "string" ? payload.env_type_id : undefined,
				issued_by_user_id: request.requested_by_user_id || reviewer_user_id,
				common_name: String(payload.common_name ?? ""),
				sans: Array.isArray(payload.sans) ? payload.sans.map(String) : [],
				ttl_days: typeof payload.ttl_days === "number" ? payload.ttl_days : 90,
				description: typeof payload.description === "string" ? payload.description : undefined,
				skipApproval: true,
			});
		}
		return;
	}

	const openedEnvItems = await Promise.all(envItems.map(item => openApplyItem(request, item)));
	const openedSecretItems = await Promise.all(secretItems.map(item => openApplyItem(request, item)));
	for (const item of openedEnvItems) {
		await applyEnvItem(request, item, reviewer_user_id);
	}
	for (const item of openedSecretItems) {
		await applySecretItem(request, item, reviewer_user_id);
	}

	if (openedEnvItems.length > 0) {
		await EnvStorePiTService.createEnvStorePiT({
			org_id: request.org_id,
			app_id: request.app_id,
			env_type_id: request.target_env_type_id,
			change_request_message: request.message,
			user_id: reviewer_user_id,
			envs: openedEnvItems.map((item) => ({
				key: item.key,
				value: pitValue(item),
				operation: item.operation as "CREATE" | "UPDATE" | "DELETE",
			})),
		});
	}
	if (openedSecretItems.length > 0) {
		await SecretStorePiTService.createSecretStorePiT({
			org_id: request.org_id,
			app_id: request.app_id,
			env_type_id: request.target_env_type_id,
			change_request_message: request.message,
			user_id: reviewer_user_id,
			envs: openedSecretItems.map((item) => ({
				key: item.key,
				value: pitValue(item),
				operation: item.operation as "CREATE" | "UPDATE" | "DELETE",
			})),
		});
	}
}
