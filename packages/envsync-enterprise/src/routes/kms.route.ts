import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { KmsController } from "../controllers/kms.controller";
import { authMiddleware } from "envsync-api/ports/middlewares";
import { enterpriseGuard } from "envsync-api/ports/middlewares";
import { orgFeatureGuard } from "envsync-api/ports/middlewares";
import { platformAdminMiddleware } from "envsync-api/ports/middlewares";
import { requirePermission } from "envsync-api/ports/middlewares";
import { errorResponseSchema } from "envsync-api/ports/validators-common";
import {
	createOrgKmsCredentialRequestSchema,
	orgKmsAppsResponseSchema,
	orgKmsBreakGlassParamSchema,
	orgKmsConfigResponseSchema,
	orgKmsCredentialResponseSchema,
	orgKmsJobParamSchema,
	orgKmsJobResponseSchema,
	orgKmsVerifyResponseSchema,
	updateOrgKmsConfigRequestSchema,
} from "../validators/kms.validator";
import { registerCmkTenantWrappingProvider } from "../services/cmk.service";

registerCmkTenantWrappingProvider();

const app = new Hono();

const platformTokenParam = {
	name: "X-EnvSync-Platform-Token",
	in: "header" as const,
	required: true,
	schema: { type: "string" as const },
};

app.post(
	"/:orgId/break-glass-detach",
	describeRoute({
		operationId: "breakGlassDetachOrgKms",
		summary: "Break-glass detach organization CMK",
		description:
			"Hosted platform API. Enqueues detach-to-managed even if the org lost the kms grant or status is unavailable. Does not call ensureTenantKek.",
		tags: ["Enterprise CMK"],
		parameters: [platformTokenParam],
		responses: {
			200: {
				description: "Already on managed wrapping",
				content: { "application/json": { schema: resolver(orgKmsJobResponseSchema) } },
			},
			202: {
				description: "Detach job enqueued",
				content: { "application/json": { schema: resolver(orgKmsJobResponseSchema) } },
			},
			401: {
				description: "Invalid platform token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Not hosted",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	platformAdminMiddleware(),
	zValidator("param", orgKmsBreakGlassParamSchema),
	KmsController.breakGlassDetach,
);

const manage = new Hono();
manage.use(authMiddleware());
manage.use(enterpriseGuard("kms"));
manage.use(requirePermission("can_manage_org_settings", "org"));
manage.use(orgFeatureGuard("kms"));

manage.get(
	"/",
	describeRoute({
		operationId: "getOrgKmsConfig",
		summary: "Get organization KMS config",
		description: "Returns implicit managed/active when no org_kms_config row exists. Never returns key material.",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "Organization KMS config",
				content: { "application/json": { schema: resolver(orgKmsConfigResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.getConfig,
);

manage.put(
	"/",
	describeRoute({
		operationId: "updateOrgKmsConfig",
		summary: "Update organization KMS config",
		description: "Self-host cloud sources return 403 CMK_HOSTED_ONLY. Hosted persists cloud source as pending until attach.",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "Organization KMS config updated",
				content: { "application/json": { schema: resolver(orgKmsConfigResponseSchema) } },
			},
			403: {
				description: "Cloud CMK is Hosted-only",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			409: {
				description: "A rewrap job is already running",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", updateOrgKmsConfigRequestSchema),
	KmsController.updateConfig,
);

manage.post(
	"/credentials",
	describeRoute({
		operationId: "createOrgKmsCredential",
		summary: "Create a purpose=kms org secret",
		description: "Encrypts the value under scope __kms_config__ before insert. Does not require the integrations feature.",
		tags: ["Enterprise CMK"],
		responses: {
			201: {
				description: "Credential created (value redacted)",
				content: { "application/json": { schema: resolver(orgKmsCredentialResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", createOrgKmsCredentialRequestSchema),
	KmsController.createCredential,
);

manage.post(
	"/verify",
	describeRoute({
		operationId: "verifyOrgKms",
		summary: "Verify organization KMS",
		description: "Managed source succeeds immediately. Cloud verify unwraps or first-wraps the tenant KEK.",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "Verify result",
				content: { "application/json": { schema: resolver(orgKmsVerifyResponseSchema) } },
			},
			503: {
				description: "CMK unavailable",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.verify,
);

manage.post(
	"/rotate-kek",
	describeRoute({
		operationId: "rotateOrgKmsKek",
		summary: "Rotate organization KEK",
		description: "Re-wraps wrapped_kek under the current key_ref. Hosted cloud-only; does not rewrap DEKs.",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "KEK rotated",
				content: { "application/json": { schema: resolver(orgKmsConfigResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.rotateKek,
);

manage.post(
	"/attach",
	describeRoute({
		operationId: "attachOrgKms",
		summary: "Attach organization CMK",
		description:
			"Enqueues DEK rewrap under the tenant KEK with allow_root_unwrap during the attach window. Hosted only.",
		tags: ["Enterprise CMK"],
		responses: {
			202: {
				description: "Attach job enqueued",
				content: { "application/json": { schema: resolver(orgKmsJobResponseSchema) } },
			},
			403: {
				description: "Cloud CMK is Hosted-only",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			409: {
				description: "A rewrap job is already running",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.attach,
);

manage.post(
	"/detach",
	describeRoute({
		operationId: "detachOrgKms",
		summary: "Detach organization CMK to managed",
		description: "Enqueues detach_managed. Does not call ensureTenantKek when status is unavailable.",
		tags: ["Enterprise CMK"],
		responses: {
			202: {
				description: "Detach job enqueued",
				content: { "application/json": { schema: resolver(orgKmsJobResponseSchema) } },
			},
			409: {
				description: "A rewrap job is already running",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.detach,
);

manage.get(
	"/jobs/:id",
	describeRoute({
		operationId: "getOrgKmsJob",
		summary: "Get organization KMS job",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "KMS job",
				content: { "application/json": { schema: resolver(orgKmsJobResponseSchema) } },
			},
			404: {
				description: "Job not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", orgKmsJobParamSchema),
	KmsController.getJob,
);

manage.get(
	"/apps",
	describeRoute({
		operationId: "listOrgKmsApps",
		summary: "List per-app KMS key info",
		description: "Calls GetKeyInfo per app. Never returns key material.",
		tags: ["Enterprise CMK"],
		responses: {
			200: {
				description: "Per-app key metadata",
				content: { "application/json": { schema: resolver(orgKmsAppsResponseSchema) } },
			},
			503: {
				description: "CMK unavailable",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	KmsController.listApps,
);

app.route("/", manage);

export default app;
