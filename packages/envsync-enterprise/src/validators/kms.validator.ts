import z from "zod";

import "zod-openapi/extend";

const kmsSourceEnum = z.enum(["managed", "aws-kms", "gcp-kms", "azure-kv"]);
const kmsStatusEnum = z.enum(["active", "pending", "rotating", "unavailable", "disabled"]);
const kmsJobKindEnum = z.enum(["kek_rewrap", "dek_rewrap", "detach_managed"]);
const kmsJobStatusEnum = z.enum(["pending", "running", "succeeded", "failed"]);

export const updateOrgKmsConfigRequestSchema = z
	.object({
		source: kmsSourceEnum.openapi({ example: "managed" }),
		key_ref: z.string().min(1).nullable().optional().openapi({ example: "arn:aws:kms:us-east-1:123:key/abc" }),
		region: z.string().min(1).nullable().optional().openapi({ example: "us-east-1" }),
		credential_secret_id: z.string().min(1).nullable().optional().openapi({ example: "secret_123" }),
	})
	.openapi({ ref: "UpdateOrgKmsConfigRequest" });

export const createOrgKmsCredentialRequestSchema = z
	.object({
		key: z.string().min(1).openapi({ example: "aws-kms-prod" }),
		value: z.string().min(1).openapi({ example: "AKIA..." }),
		description: z.string().nullable().optional().openapi({ example: "AWS access key for org CMK" }),
	})
	.openapi({ ref: "CreateOrgKmsCredentialRequest" });

export const orgKmsCredentialResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		org_id: z.string().openapi({ example: "org_123" }),
		key: z.string().openapi({ example: "aws-kms-prod" }),
		description: z.string().nullable().openapi({ example: "AWS access key for org CMK" }),
		configured: z.literal(true).openapi({ example: true }),
		created_at: z.string().openapi({ example: "2026-09-13T00:00:00.000Z" }),
		updated_at: z.string().openapi({ example: "2026-09-13T00:00:00.000Z" }),
	})
	.openapi({ ref: "OrgKmsCredentialResponse" });

export const orgKmsConfigResponseSchema = z
	.object({
		org_id: z.string().openapi({ example: "org_123" }),
		source: kmsSourceEnum.openapi({ example: "managed" }),
		status: kmsStatusEnum.openapi({ example: "active" }),
		key_ref: z.string().nullable().openapi({ example: null }),
		region: z.string().nullable().openapi({ example: null }),
		credential_secret_id: z.string().nullable().openapi({ example: null }),
		kek_version: z.number().int().openapi({ example: 1 }),
		last_verified_at: z.string().nullable().openapi({ example: null }),
		last_error: z.string().nullable().openapi({ example: null }),
		implicit: z.boolean().openapi({ example: true }),
		credentials: z.array(orgKmsCredentialResponseSchema).optional(),
	})
	.openapi({ ref: "OrgKmsConfigResponse" });

export const orgKmsVerifyResponseSchema = z
	.object({
		ok: z.boolean().openapi({ example: true }),
		source: kmsSourceEnum.openapi({ example: "managed" }),
		status: kmsStatusEnum.openapi({ example: "active" }),
		last_verified_at: z.string().openapi({ example: "2026-09-13T00:00:00.000Z" }),
	})
	.openapi({ ref: "OrgKmsVerifyResponse" });

export const orgKmsJobResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		org_id: z.string().openapi({ example: "org_123" }),
		app_id: z.string().nullable().openapi({ example: null }),
		kind: kmsJobKindEnum.openapi({ example: "detach_managed" }),
		status: kmsJobStatusEnum.openapi({ example: "pending" }),
		progress: z.record(z.unknown()).openapi({ example: {} }),
		error_message: z.string().nullable().openapi({ example: null }),
		created_by: z.string().nullable().openapi({ example: "user_123" }),
		created_at: z.string().openapi({ example: "2026-09-13T00:00:00.000Z" }),
		updated_at: z.string().openapi({ example: "2026-09-13T00:00:00.000Z" }),
	})
	.openapi({ ref: "OrgKmsJobResponse" });

export const orgKmsAppKeyInfoSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		name: z.string().openapi({ example: "api" }),
		key_version_id: z.string().nullable().openapi({ example: "kv-1" }),
		version: z.number().int().nullable().openapi({ example: 1 }),
		encryption_count: z.number().int().nullable().openapi({ example: 0 }),
		max_encryptions: z.number().int().nullable().openapi({ example: 0 }),
		status: z.string().openapi({ example: "active" }),
	})
	.openapi({ ref: "OrgKmsAppKeyInfo" });

export const orgKmsAppsResponseSchema = z
	.object({
		apps: z.array(orgKmsAppKeyInfoSchema),
	})
	.openapi({ ref: "OrgKmsAppsResponse" });

export const orgKmsJobParamSchema = z
	.object({
		id: z.string().min(1).openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
	})
	.openapi({ ref: "OrgKmsJobParam" });

export const orgKmsBreakGlassParamSchema = z
	.object({
		orgId: z.string().min(1).openapi({ example: "org_123" }),
	})
	.openapi({ ref: "OrgKmsBreakGlassParam" });
