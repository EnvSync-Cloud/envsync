import type { Context } from "hono";

import { OrgService } from "@/services/org.service";
import { AuditLogService } from "@/services/audit_log.service";

export class OrgController {
	public static readonly getOrg = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const org = await OrgService.getOrg(org_id);
			return c.json(org);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly checkIfSlugExists = async (c: Context) => {
		try {
			const { slug } = c.req.query();

			if (!slug) {
				return c.json({ error: "Slug is required." }, 400);
			}

			const exists = await OrgService.checkIfSlugExists(slug);
			return c.json({ exists });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateOrg = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const { logo_url, website, name, slug } = await c.req.json();

			// Only master can update the organization details
			const permissions = c.get("permissions");

			if (!permissions.is_master) {
				return c.json({ error: "You do not have permission to update the organization." }, 403);
			}

			const org = await OrgService.getOrg(org_id);

			const updatedData = {
				logo_url: logo_url ?? org.logo_url,
				website: website ?? org.website,
				name: name ?? org.name,
				slug: slug ?? org.slug,
			};

			// check if the slug already exists
			if (slug) {
				const exists = await OrgService.checkIfSlugExists(slug);
				if (exists) {
					return c.json({ error: "Slug already exists." }, 400);
				}
			}

			await OrgService.updateOrg(org_id, updatedData);

			// Log the organization update
			await AuditLogService.notifyAuditSystem({
				action: "org_updated",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `Organization ${org.name} updated.`,
				details: {
					logo_url,
					website,
					name,
					slug,
				},
			});

			return c.json({ message: "Organization updated successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
