import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { enterpriseManagementModules } from "envsync-enterprise";
import {
	clearManagementModulesForTests,
	loadApiModules,
	registerManagementModules,
} from "@/modules/load-modules";

describe("API module surface boundaries", () => {
	beforeEach(() => {
		clearManagementModulesForTests();
	});

	afterEach(() => {
		clearManagementModulesForTests();
	});

	test("core surface excludes management-only modules while exposing shared onboarding routes", () => {
		const moduleNames = loadApiModules("core").map(module => module.name);

		expect(moduleNames).toContain("system");
		expect(moduleNames).toContain("app");
		expect(moduleNames).toContain("onboarding");
		expect(moduleNames).not.toContain("license");
		expect(moduleNames).not.toContain("enterprise");
	});

	test("management surface is empty until enterprise package registers modules", () => {
		expect(loadApiModules("management")).toEqual([]);
	});

	test("management surface exposes enterprise modules after registration", () => {
		registerManagementModules(enterpriseManagementModules);
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

	test("core loadApiModules never pulls enterprise registration", () => {
		registerManagementModules(enterpriseManagementModules);
		const coreNames = loadApiModules("core").map(m => m.name);
		expect(coreNames).not.toContain("license");
		expect(coreNames).not.toContain("enterprise");
		expect(coreNames).not.toContain("oidc");
	});
});
