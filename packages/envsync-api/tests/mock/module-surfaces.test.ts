import { describe, expect, test } from "bun:test";

import { loadApiModules } from "@/modules/load-modules";

describe("API module surface boundaries", () => {
	test("core surface excludes management-only modules while exposing shared onboarding routes", () => {
		const moduleNames = loadApiModules("core").map(module => module.name);

		expect(moduleNames).toContain("system");
		expect(moduleNames).toContain("app");
		expect(moduleNames).toContain("onboarding");
		expect(moduleNames).not.toContain("license");
		expect(moduleNames).not.toContain("enterprise");
	});

	test("management surface exposes only management modules", () => {
		const moduleNames = loadApiModules("management").map(module => module.name);

		expect(moduleNames).toEqual([
			"onboarding",
			"license",
			"enterprise",
			"system",
			"oidc",
			"saml",
			"rotation",
			"dynamic_secret",
			"log_forwarding",
		]);
		expect(moduleNames).not.toContain("app");
		expect(moduleNames).not.toContain("auth");
		expect(moduleNames).not.toContain("secret");
	});
});
