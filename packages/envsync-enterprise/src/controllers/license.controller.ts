import type { Context } from "hono";

import { LicenseStateService } from "@/services/license-state.service";

export class LicenseController {
	public static readonly status = async (c: Context) => {
		const decision = await LicenseStateService.getEnforcementDecision();
		return c.json({
			required: decision.required,
			locked: decision.locked,
			reason: decision.reason,
			state: decision.state,
		});
	};

	public static readonly activate = async (c: Context) => {
		const state = await LicenseStateService.activateLicense();
		return c.json({ message: "License activated.", state });
	};

	public static readonly verify = async (c: Context) => {
		const state = await LicenseStateService.verifyLicenseNow();
		return c.json({ message: "License verified.", state });
	};
}
