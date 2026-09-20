import type { Context } from "hono";

import { PlatformOrgService } from "@/services/platform-org.service";

export class PlatformController {
	public static readonly provisionOrganization = async (c: Context) => {
		const payload = await c.req.json<{
			mode: "existing_identity" | "fresh_tenant";
			organization_name: string;
			slug?: string;
			plan?: string;
			overlay_features?: string[];
			membership_user_id?: string;
			admin_email?: string;
			admin_full_name?: string;
			actor_email?: string;
		}>();
		const result = await PlatformOrgService.provision(payload);
		return c.json(result, 201);
	};
}
