import type { Context } from "hono";

import { assertEntitled } from "envsync-api/ports/helpers";
import { AuditLogService, OrgService } from "envsync-api/ports/services";

import { CmkCredentialService } from "../services/cmk-credential.service";
import { CmkService, type KmsSource } from "../services/cmk.service";

export class KmsController {
	public static readonly getConfig = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const view = await CmkService.getStatusView(orgId);
		return c.json(view);
	};

	public static readonly updateConfig = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const body = c.req.valid("json" as never) as {
			source: KmsSource;
			key_ref?: string | null;
			region?: string | null;
			credential_secret_id?: string | null;
		};
		const updated = await CmkService.updateConfig(orgId, body);
		await AuditLogService.notifyAuditSystem({
			action: "kms_source_changed",
			org_id: orgId,
			user_id: userId,
			message: `KMS source set to ${updated.source}`,
			details: { source: updated.source, status: updated.status },
		});
		return c.json(updated);
	};

	public static readonly createCredential = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const body = c.req.valid("json" as never) as {
			key: string;
			value: string;
			description?: string | null;
		};
		const created = await CmkCredentialService.create({
			org_id: orgId,
			key: body.key,
			value: body.value,
			description: body.description,
		});
		await AuditLogService.notifyAuditSystem({
			action: "kms_credential_created",
			org_id: orgId,
			user_id: userId,
			message: `KMS credential created: ${created.key}`,
			details: { credential_id: created.id, key: created.key },
		});
		return c.json(created, 201);
	};

	public static readonly verify = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const result = await CmkService.verify(orgId);
		await AuditLogService.notifyAuditSystem({
			action: "kms_verify",
			org_id: orgId,
			user_id: userId,
			message: `KMS verify ${result.ok ? "succeeded" : "failed"}`,
			details: { source: result.source, status: result.status },
		});
		return c.json(result);
	};

	public static readonly rotateKek = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const updated = await CmkService.rotateKek(orgId);
		await AuditLogService.notifyAuditSystem({
			action: "kms_kek_rotated",
			org_id: orgId,
			user_id: userId,
			message: "KMS KEK rotated",
			details: { kek_version: updated.kek_version },
		});
		return c.json(updated);
	};

	public static readonly attach = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const job = await CmkService.attach(orgId, userId);
		await AuditLogService.notifyAuditSystem({
			action: "kms_dek_rewrap_enqueued",
			org_id: orgId,
			user_id: userId,
			message: "KMS attach rewrap enqueued",
			details: { job_id: job.id, kind: job.kind },
		});
		return c.json(job, 202);
	};

	public static readonly detach = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const userId = c.get("user_id");
		const job = await CmkService.detach(orgId, userId);
		await AuditLogService.notifyAuditSystem({
			action: "kms_detach_enqueued",
			org_id: orgId,
			user_id: userId,
			message: "KMS detach to managed enqueued",
			details: { job_id: job.id },
		});
		return c.json(job, 202);
	};

	public static readonly getJob = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const job = await CmkService.getJob(orgId, c.req.param("id"));
		return c.json(job);
	};

	public static readonly listApps = async (c: Context) => {
		await assertEntitled("kms");
		const orgId = c.get("org_id");
		const apps = await CmkService.listApps(orgId);
		return c.json({ apps });
	};

	public static readonly breakGlassDetach = async (c: Context) => {
		const orgId = c.req.param("orgId");
		await OrgService.getOrg(orgId);
		const job = await CmkService.breakGlassDetach(orgId, "platform");
		return c.json(job, job.status === "succeeded" ? 200 : 202);
	};
}
