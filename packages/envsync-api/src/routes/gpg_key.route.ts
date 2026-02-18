import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { GpgKeyController } from "@/controllers/gpg_key.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	generateGpgKeyRequestSchema,
	importGpgKeyRequestSchema,
	signDataRequestSchema,
	verifySignatureRequestSchema,
	revokeGpgKeyRequestSchema,
	updateTrustLevelRequestSchema,
	gpgKeyResponseSchema,
	gpgKeyDetailResponseSchema,
	gpgKeysResponseSchema,
	signatureResponseSchema,
	verifyResponseSchema,
	exportKeyResponseSchema,
} from "@/validators/gpg_key.validator";
import { errorResponseSchema } from "@/validators/common";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

// ─── Generate a new GPG key ────────────────────────────────────────
app.put(
	"/generate",
	requirePermission("can_manage_gpg_keys", "org"),
	describeRoute({
		operationId: "generateGpgKey",
		summary: "Generate GPG Key",
		description: "Generate a new GPG key pair for the organization",
		tags: ["GPG Keys"],
		responses: {
			201: {
				description: "GPG key generated successfully",
				content: { "application/json": { schema: resolver(gpgKeyResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", generateGpgKeyRequestSchema),
	GpgKeyController.generateKey,
);

// ─── Import an existing GPG key ────────────────────────────────────
app.put(
	"/import",
	requirePermission("can_manage_gpg_keys", "org"),
	describeRoute({
		operationId: "importGpgKey",
		summary: "Import GPG Key",
		description: "Import an existing GPG key into the organization",
		tags: ["GPG Keys"],
		responses: {
			201: {
				description: "GPG key imported successfully",
				content: { "application/json": { schema: resolver(gpgKeyResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", importGpgKeyRequestSchema),
	GpgKeyController.importKey,
);

// ─── Sign data ─────────────────────────────────────────────────────
app.post(
	"/sign",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "signDataWithGpgKey",
		summary: "Sign Data",
		description: "Sign data using a GPG key",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "Data signed successfully",
				content: { "application/json": { schema: resolver(signatureResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", signDataRequestSchema),
	GpgKeyController.signData,
);

// ─── Verify signature ──────────────────────────────────────────────
app.post(
	"/verify",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "verifyGpgSignature",
		summary: "Verify Signature",
		description: "Verify a GPG signature",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "Verification result",
				content: { "application/json": { schema: resolver(verifyResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", verifySignatureRequestSchema),
	GpgKeyController.verifySignature,
);

// ─── List all GPG keys ─────────────────────────────────────────────
app.get(
	"/",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "listGpgKeys",
		summary: "List GPG Keys",
		description: "List all GPG keys for the organization",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "GPG keys retrieved successfully",
				content: { "application/json": { schema: resolver(gpgKeysResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	GpgKeyController.listKeys,
);

// ─── Get a specific GPG key ────────────────────────────────────────
app.get(
	"/:id",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "getGpgKey",
		summary: "Get GPG Key",
		description: "Retrieve a specific GPG key",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "GPG key retrieved successfully",
				content: { "application/json": { schema: resolver(gpgKeyDetailResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	GpgKeyController.getKey,
);

// ─── Export public key ─────────────────────────────────────────────
app.get(
	"/:id/export",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "exportGpgPublicKey",
		summary: "Export GPG Public Key",
		description: "Export the ASCII-armored public key",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "Public key exported successfully",
				content: { "application/json": { schema: resolver(exportKeyResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	GpgKeyController.exportKey,
);

// ─── Delete a GPG key ──────────────────────────────────────────────
app.delete(
	"/:id",
	requirePermission("can_manage_gpg_keys", "org"),
	describeRoute({
		operationId: "deleteGpgKey",
		summary: "Delete GPG Key",
		description: "Delete a GPG key from the organization",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "GPG key deleted successfully",
				content: { "application/json": { schema: resolver(gpgKeyResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	GpgKeyController.deleteKey,
);

// ─── Revoke a GPG key ──────────────────────────────────────────────
app.post(
	"/:id/revoke",
	requirePermission("can_manage_gpg_keys", "org"),
	describeRoute({
		operationId: "revokeGpgKey",
		summary: "Revoke GPG Key",
		description: "Revoke a GPG key (keeps data but marks as revoked)",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "GPG key revoked successfully",
				content: { "application/json": { schema: resolver(gpgKeyDetailResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", revokeGpgKeyRequestSchema),
	GpgKeyController.revokeKey,
);

// ─── Update trust level ────────────────────────────────────────────
app.patch(
	"/:id/trust",
	requirePermission("can_manage_gpg_keys", "org"),
	describeRoute({
		operationId: "updateGpgKeyTrustLevel",
		summary: "Update Trust Level",
		description: "Update the trust level of a GPG key",
		tags: ["GPG Keys"],
		responses: {
			200: {
				description: "Trust level updated successfully",
				content: { "application/json": { schema: resolver(gpgKeyDetailResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", updateTrustLevelRequestSchema),
	GpgKeyController.updateTrustLevel,
);

export default app;
