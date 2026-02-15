import { type Context } from "hono";

import { UserService } from "@/services/user.service";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";

export class AuthController {
	public static readonly whoami = async (c: Context) => {
		try {
			const user = await UserService.getUser(c.get("user_id"));
			const org = await OrgService.getOrg(user.org_id);
			const role = await RoleService.getRole(user.role_id);

			return c.json({
				user,
				org,
				role,
			});
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}
