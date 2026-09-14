import z from "zod";
import "zod-openapi/extend";

const operationSchema = z.enum(["CREATE", "UPDATE", "DELETE"]);
const statusSchema = z.enum(["pending", "applying", "approved", "rejected", "cancelled", "failed"]);

export const directChangeRequestBodySchema = z
	.object({
		app_id: z.string().min(1),
		target_env_type_id: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
		envs: z
			.array(
				z.object({
					key: z.string().min(1),
					operation: operationSchema,
					proposed_value: z.string().optional().nullable(),
				}),
			)
			.optional(),
		secrets: z
			.array(
				z.object({
					key: z.string().min(1),
					operation: operationSchema,
					proposed_value: z.string().optional().nullable(),
				}),
			)
			.optional(),
	})
	.openapi({ ref: "DirectChangeRequestBody" });

export const promotionChangeRequestBodySchema = z
	.object({
		app_id: z.string().min(1),
		source_env_type_id: z.string().min(1),
		target_env_type_id: z.string().min(1),
		title: z.string().min(1),
		message: z.string().min(1),
	})
	.openapi({ ref: "PromotionChangeRequestBody" });

export const rejectChangeRequestBodySchema = z
	.object({
		rejection_reason: z.string().min(1),
	})
	.openapi({ ref: "RejectChangeRequestBody" });

export const changeRequestResponseSchema = z
	.object({
		id: z.string(),
		org_id: z.string(),
		app_id: z.string(),
		request_kind: z.enum(["direct", "promotion"]),
		source_env_type_id: z.string().nullable(),
		target_env_type_id: z.string(),
		status: statusSchema,
		title: z.string(),
		message: z.string(),
		requested_by_user_id: z.string(),
		reviewed_by_user_id: z.string().nullable(),
		reviewed_at: z.string().nullable(),
		applied_at: z.string().nullable(),
		rejection_reason: z.string().nullable(),
		created_at: z.string(),
		updated_at: z.string(),
		env_item_count: z.number(),
		secret_item_count: z.number(),
		env_items: z.array(
			z.object({
				id: z.string(),
				change_request_id: z.string(),
				key: z.string(),
				previous_value: z.string().nullable(),
				proposed_value: z.string().nullable(),
				operation: operationSchema,
				created_at: z.string(),
				updated_at: z.string(),
			}),
		),
		secret_items: z.array(
			z.object({
				id: z.string(),
				change_request_id: z.string(),
				key: z.string(),
				previous_value: z.string().nullable(),
				proposed_value: z.string().nullable(),
				operation: operationSchema,
				created_at: z.string(),
				updated_at: z.string(),
			}),
		),
	})
	.openapi({ ref: "ChangeRequestResponse" });

export const changeRequestListResponseSchema = z
	.array(changeRequestResponseSchema)
	.openapi({ ref: "ChangeRequestListResponse" });
