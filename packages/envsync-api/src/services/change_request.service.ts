import { v4 as uuidv4 } from "uuid";

import { smartEncrypt } from "@/helpers/key-store";
import { DB } from "@/libs/db";
import { BusinessRuleError, ValidationError, orNotFound } from "@/libs/errors";
import { AppService } from "@/services/app.service";
import { AuthorizationService } from "@/services/authorization.service";
import { applyChangeRequestItems } from "@/services/change_request_apply";
import { EnvService } from "@/services/env.service";
import { EnvTypeService } from "@/services/env_type.service";
import { SecretService } from "@/services/secret.service";

type ChangeOperation = "CREATE" | "UPDATE" | "DELETE";

type EnvItemInput = {
	key: string;
	operation: ChangeOperation;
	proposed_value?: string | null;
};

type SecretItemInput = {
	key: string;
	operation: ChangeOperation;
	proposed_value?: string | null;
};

function hasAnyItems(envs?: EnvItemInput[], secrets?: SecretItemInput[]) {
	return (envs?.length ?? 0) > 0 || (secrets?.length ?? 0) > 0;
}

export class ChangeRequestService {
	public static createDirect = async ({
		org_id,
		app_id,
		target_env_type_id,
		requested_by_user_id,
		title,
		message,
		envs,
		secrets,
	}: {
		org_id: string;
		app_id: string;
		target_env_type_id: string;
		requested_by_user_id: string;
		title: string;
		message: string;
		envs?: EnvItemInput[];
		secrets?: SecretItemInput[];
	}) => {
		if (!hasAnyItems(envs, secrets)) {
			throw new ValidationError("At least one env or secret change is required.");
		}

		const targetEnvType = await EnvTypeService.getEnvType(target_env_type_id);
		if (targetEnvType.org_id !== org_id || targetEnvType.app_id !== app_id) {
			throw new BusinessRuleError("Target environment type does not belong to the app.", 403);
		}
		if (!targetEnvType.is_protected) {
			throw new BusinessRuleError("Direct change requests are only required for protected environments.");
		}

		const orgPermissions = await AuthorizationService.getUserOrgPermissions(requested_by_user_id, org_id);
		if (!(orgPermissions.can_edit || orgPermissions.is_admin || orgPermissions.is_master)) {
			throw new BusinessRuleError("You do not have permission to create a change request.", 403);
		}

		const app = await AppService.getApp({ id: app_id });
		if ((secrets?.length ?? 0) > 0 && !app.public_key) {
			throw new BusinessRuleError("App public key is required to stage secret changes.");
		}
		const db = await DB.getInstance();
		const now = new Date();
		const changeRequestId = uuidv4();

		const envItems = await Promise.all(
			(envs ?? []).map(async (item) => {
				const existing = await EnvService.getEnv({
					key: item.key,
					env_type_id: target_env_type_id,
					app_id,
					org_id,
					user_id: requested_by_user_id,
				});

				return {
					id: uuidv4(),
					change_request_id: changeRequestId,
					key: item.key,
					previous_value: existing?.value ?? null,
					proposed_value: item.operation === "DELETE" ? null : (item.proposed_value ?? ""),
					operation: item.operation,
					created_at: now,
					updated_at: now,
				};
			}),
		);

		const secretItems = await Promise.all(
			(secrets ?? []).map(async (item) => {
				const existing = await SecretService.getSecret({
					key: item.key,
					env_type_id: target_env_type_id,
					app_id,
					org_id,
					user_id: requested_by_user_id,
				});
				const encryptedValue =
					item.operation === "DELETE"
						? null
						: smartEncrypt(item.proposed_value ?? "", app.public_key || "");

				return {
					id: uuidv4(),
					change_request_id: changeRequestId,
					key: item.key,
					previous_value: existing?.value ?? null,
					proposed_value: encryptedValue,
					operation: item.operation,
					created_at: now,
					updated_at: now,
				};
			}),
		);

		await db.transaction().execute(async (trx) => {
			await trx
				.insertInto("change_request")
				.values({
					id: changeRequestId,
					org_id,
					app_id,
					request_kind: "direct",
					source_env_type_id: null,
					target_env_type_id,
					status: "pending",
					title,
					message,
					requested_by_user_id,
					reviewed_by_user_id: null,
					reviewed_at: null,
					applied_at: null,
					rejection_reason: null,
					created_at: now,
					updated_at: now,
				})
				.execute();

			if (envItems.length > 0) {
				await trx.insertInto("change_request_env_item").values(envItems).execute();
			}
			if (secretItems.length > 0) {
				await trx.insertInto("change_request_secret_item").values(secretItems).execute();
			}
		});

		return this.getChangeRequest(changeRequestId, org_id);
	};

	public static createPromotion = async ({
		org_id,
		app_id,
		source_env_type_id,
		target_env_type_id,
		requested_by_user_id,
		title,
		message,
	}: {
		org_id: string;
		app_id: string;
		source_env_type_id: string;
		target_env_type_id: string;
		requested_by_user_id: string;
		title: string;
		message: string;
	}) => {
		if (source_env_type_id === target_env_type_id) {
			throw new ValidationError("Source and target environments must be different.");
		}

		const [sourceEnvType, targetEnvType] = await Promise.all([
			EnvTypeService.getEnvType(source_env_type_id),
			EnvTypeService.getEnvType(target_env_type_id),
		]);
		if (sourceEnvType.org_id !== org_id || sourceEnvType.app_id !== app_id) {
			throw new BusinessRuleError("Source environment type does not belong to the app.", 403);
		}
		if (targetEnvType.org_id !== org_id || targetEnvType.app_id !== app_id) {
			throw new BusinessRuleError("Target environment type does not belong to the app.", 403);
		}
		if (!targetEnvType.is_protected) {
			throw new BusinessRuleError("Promotion requests in this pass target protected environments only.");
		}

		const orgPermissions = await AuthorizationService.getUserOrgPermissions(requested_by_user_id, org_id);
		if (!(orgPermissions.can_edit || orgPermissions.is_admin || orgPermissions.is_master)) {
			throw new BusinessRuleError("You do not have permission to create a promotion request.", 403);
		}

		const app = await AppService.getApp({ id: app_id });
		const [envs, secrets] = await Promise.all([
			EnvService.getAllEnv({
				app_id,
				org_id,
				env_type_id: source_env_type_id,
				user_id: requested_by_user_id,
			}),
			SecretService.getAllSecret({
				app_id,
				org_id,
				env_type_id: source_env_type_id,
				user_id: requested_by_user_id,
			}),
		]);
		if (secrets.length > 0 && !app.public_key) {
			throw new BusinessRuleError("App public key is required to snapshot secret promotions.");
		}

		const db = await DB.getInstance();
		const now = new Date();
		const changeRequestId = uuidv4();

		await db.transaction().execute(async (trx) => {
			await trx
				.insertInto("change_request")
				.values({
					id: changeRequestId,
					org_id,
					app_id,
					request_kind: "promotion",
					source_env_type_id,
					target_env_type_id,
					status: "pending",
					title,
					message,
					requested_by_user_id,
					created_at: now,
					updated_at: now,
				})
				.execute();

			if (envs.length > 0) {
				await trx
					.insertInto("change_request_env_item")
					.values(
						envs.map((item) => ({
							id: uuidv4(),
							change_request_id: changeRequestId,
							key: item.key,
							previous_value: null,
							proposed_value: item.value,
							operation: "UPDATE" as const,
							created_at: now,
							updated_at: now,
						})),
					)
					.execute();
			}

			if (secrets.length > 0) {
				await trx
					.insertInto("change_request_secret_item")
					.values(
						secrets.map((item) => ({
							id: uuidv4(),
							change_request_id: changeRequestId,
							key: item.key,
							previous_value: null,
							proposed_value: item.value,
							operation: "UPDATE" as const,
							created_at: now,
							updated_at: now,
						})),
					)
					.execute();
			}
		});

		return this.getChangeRequest(changeRequestId, org_id);
	};

	public static listChangeRequests = async (org_id: string, status?: string, appId?: string) => {
		const db = await DB.getInstance();
		let query = db
			.selectFrom("change_request")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc");

		if (status) {
			query = query.where("status", "=", status as never);
		}
		if (appId) {
			query = query.where("app_id", "=", appId);
		}

		const requests = await query.execute();
		return Promise.all(requests.map((request) => this.getChangeRequest(request.id, org_id)));
	};

	public static getChangeRequest = async (id: string, org_id: string) => {
		const db = await DB.getInstance();
		const request = await orNotFound(
			db
				.selectFrom("change_request")
				.selectAll()
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.executeTakeFirstOrThrow(),
			"Change request",
			id,
		);

		const [envItems, secretItems] = await Promise.all([
			db
				.selectFrom("change_request_env_item")
				.selectAll()
				.where("change_request_id", "=", id)
				.orderBy("created_at", "asc")
				.execute(),
			db
				.selectFrom("change_request_secret_item")
				.selectAll()
				.where("change_request_id", "=", id)
				.orderBy("created_at", "asc")
				.execute(),
		]);

		return {
			...request,
			env_items: envItems,
			secret_items: secretItems.map((item) => ({
				...item,
				previous_value: item.previous_value ? "[redacted]" : null,
				proposed_value: item.proposed_value ? "[redacted]" : null,
			})),
			env_item_count: envItems.length,
			secret_item_count: secretItems.length,
		};
	};

	public static approveChangeRequest = async ({
		id,
		org_id,
		reviewer_user_id,
	}: {
		id: string;
		org_id: string;
		reviewer_user_id: string;
	}) => {
		const db = await DB.getInstance();
		const request = await orNotFound(
			db
				.selectFrom("change_request")
				.selectAll()
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.executeTakeFirstOrThrow(),
			"Change request",
			id,
		);

		if (!["pending", "failed"].includes(request.status)) {
			throw new BusinessRuleError("Only pending or failed requests can be approved.");
		}
		if (request.requested_by_user_id === reviewer_user_id) {
			throw new BusinessRuleError("Requesters cannot approve their own change request.", 403);
		}

		const canApprove = await AuthorizationService.check(
			reviewer_user_id,
			"can_manage_protected",
			"env_type",
			request.target_env_type_id,
		);
		if (!canApprove) {
			throw new BusinessRuleError("You do not have permission to approve this change request.", 403);
		}

		const claimTime = new Date();
		const claimed = await db
			.updateTable("change_request")
			.set({
				status: "applying",
				reviewed_by_user_id: reviewer_user_id,
				reviewed_at: claimTime,
				updated_at: claimTime,
			})
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.where((eb) =>
				eb.or([
					eb.and([
						eb("status", "=", "pending"),
						eb.or([
							eb("reviewed_by_user_id", "is", null),
							eb("reviewed_by_user_id", "=", reviewer_user_id),
						]),
					]),
					eb("status", "=", "failed"),
				]),
			)
			.returning("id")
			.executeTakeFirst();
		if (!claimed) {
			throw new BusinessRuleError("This change request is no longer pending.");
		}

		const [envItems, secretItems] = await Promise.all([
			db
				.selectFrom("change_request_env_item")
				.selectAll()
				.where("change_request_id", "=", id)
				.orderBy("created_at", "asc")
				.execute(),
			db
				.selectFrom("change_request_secret_item")
				.selectAll()
				.where("change_request_id", "=", id)
				.orderBy("created_at", "asc")
				.execute(),
		]);

		try {
			await applyChangeRequestItems({
				request,
				envItems,
				secretItems,
				reviewer_user_id,
			});

			const now = new Date();
			const approved = await db
				.updateTable("change_request")
				.set({
					status: "approved",
					reviewed_by_user_id: reviewer_user_id,
					reviewed_at: now,
					applied_at: now,
					updated_at: now,
				})
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.where("status", "=", "applying")
				.where("reviewed_by_user_id", "=", reviewer_user_id)
				.returning("id")
				.executeTakeFirst();
			if (!approved) {
				throw new BusinessRuleError("This change request is no longer pending.");
			}
		} catch (err) {
			await db
				.updateTable("change_request")
				.set({
					status: "failed",
					updated_at: new Date(),
				})
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.where("status", "=", "applying")
				.where("reviewed_by_user_id", "=", reviewer_user_id)
				.execute();
			throw err;
		}

		return this.getChangeRequest(id, org_id);
	};

	public static rejectChangeRequest = async ({
		id,
		org_id,
		reviewer_user_id,
		rejection_reason,
	}: {
		id: string;
		org_id: string;
		reviewer_user_id: string;
		rejection_reason: string;
	}) => {
		const db = await DB.getInstance();
		const request = await this.getPendingForReview(id, org_id, reviewer_user_id);
		const now = new Date();

		const rejected = await db
			.updateTable("change_request")
			.set({
				status: "rejected",
				reviewed_by_user_id: reviewer_user_id,
				reviewed_at: now,
				rejection_reason,
				updated_at: now,
			})
			.where("id", "=", request.id)
			.where("org_id", "=", org_id)
			.where("status", "=", "pending")
			.where(eb =>
				eb.or([
					eb("reviewed_by_user_id", "is", null),
					eb("reviewed_by_user_id", "=", reviewer_user_id),
				]),
			)
			.returning("id")
			.executeTakeFirst();
		if (!rejected) {
			throw new BusinessRuleError("This change request is no longer pending.");
		}

		return this.getChangeRequest(id, org_id);
	};

	public static cancelChangeRequest = async ({
		id,
		org_id,
		requester_user_id,
	}: {
		id: string;
		org_id: string;
		requester_user_id: string;
	}) => {
		const db = await DB.getInstance();
		const request = await orNotFound(
			db
				.selectFrom("change_request")
				.selectAll()
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.executeTakeFirstOrThrow(),
			"Change request",
			id,
		);
		if (request.status !== "pending") {
			throw new BusinessRuleError("Only pending requests can be cancelled.");
		}
		if (request.requested_by_user_id !== requester_user_id) {
			throw new BusinessRuleError("Only the requester can cancel this change request.", 403);
		}

		const cancelled = await db
			.updateTable("change_request")
			.set({
				status: "cancelled",
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.where("status", "=", "pending")
			.where("reviewed_by_user_id", "is", null)
			.returning("id")
			.executeTakeFirst();
		if (!cancelled) {
			throw new BusinessRuleError("This change request is no longer pending.");
		}

		return this.getChangeRequest(id, org_id);
	};

	private static async getPendingForReview(id: string, org_id: string, reviewer_user_id: string) {
		const db = await DB.getInstance();
		const request = await orNotFound(
			db
				.selectFrom("change_request")
				.selectAll()
				.where("id", "=", id)
				.where("org_id", "=", org_id)
				.executeTakeFirstOrThrow(),
			"Change request",
			id,
		);
		if (request.status !== "pending") {
			throw new BusinessRuleError("Only pending requests can be reviewed.");
		}
		if (request.requested_by_user_id === reviewer_user_id) {
			throw new BusinessRuleError("Requesters cannot review their own change request.", 403);
		}
		const canApprove = await AuthorizationService.check(
			reviewer_user_id,
			"can_manage_protected",
			"env_type",
			request.target_env_type_id,
		);
		if (!canApprove) {
			throw new BusinessRuleError("You do not have permission to review this change request.", 403);
		}
		return request;
	}
}
