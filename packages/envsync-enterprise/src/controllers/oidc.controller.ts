import { type Context } from "hono";

import { assertEntitled } from "@/helpers/enterprise-guard";
import { OidcService } from "../services/oidc.service";
import { AuditLogService } from "@/services/audit_log.service";

export class OidcController {
	public static readonly createProvider = async (c: Context) => {
		await assertEntitled("oidc");

		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();

		const provider = await OidcService.createProvider({
			org_id,
			provider_type: body.provider_type,
			issuer_url: body.issuer_url,
			audience: body.audience,
			allowed_subjects: body.allowed_subjects,
		});

		await AuditLogService.notifyAuditSystem({
			action: "oidc_provider_created",
			org_id,
			user_id,
			message: `OIDC provider created: ${body.provider_type} (${body.issuer_url})`,
			details: {
				provider_id: provider.id,
				provider_type: body.provider_type,
				issuer_url: body.issuer_url,
			},
		});

		return c.json(provider, 201);
	};

	public static readonly getProvider = async (c: Context) => {
		await assertEntitled("oidc");
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		const provider = await OidcService.getProvider(id);

		if (provider.org_id !== org_id) {
			return c.json({ error: "OIDC provider not found" }, 404);
		}

		return c.json(provider, 200);
	};

	public static readonly getAllProviders = async (c: Context) => {
		await assertEntitled("oidc");
		const org_id = c.get("org_id");
		const providers = await OidcService.getProvidersByOrg(org_id);
		return c.json(providers, 200);
	};

	public static readonly updateProvider = async (c: Context) => {
		await assertEntitled("oidc");

		const id = c.req.param("id");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();

		const existing = await OidcService.getProvider(id);

		if (existing.org_id !== org_id) {
			return c.json({ error: "OIDC provider not found" }, 404);
		}

		await OidcService.updateProvider(id, {
			audience: body.audience,
			enabled: body.enabled,
			allowed_subjects: body.allowed_subjects,
		});

		await AuditLogService.notifyAuditSystem({
			action: "oidc_provider_updated",
			org_id,
			user_id,
			message: `OIDC provider updated: ${id}`,
			details: { provider_id: id },
		});

		return c.json({ message: "OIDC provider updated successfully." }, 200);
	};

	public static readonly deleteProvider = async (c: Context) => {
		await assertEntitled("oidc");
		const id = c.req.param("id");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const existing = await OidcService.getProvider(id);

		if (existing.org_id !== org_id) {
			return c.json({ error: "OIDC provider not found" }, 404);
		}

		await OidcService.deleteProvider(id);

		await AuditLogService.notifyAuditSystem({
			action: "oidc_provider_deleted",
			org_id,
			user_id,
			message: `OIDC provider deleted: ${id}`,
			details: { provider_id: id, issuer_url: existing.issuer_url },
		});

		return c.json({ message: "OIDC provider deleted successfully." }, 200);
	};
}
