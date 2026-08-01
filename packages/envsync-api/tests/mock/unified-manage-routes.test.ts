import { afterEach, describe, expect, test } from "bun:test";

import { enterpriseManagementModules } from "envsync-enterprise";

import { createApiApp } from "@/app/factory";
import {
	MANAGE_API_PREFIX,
	clearManagementModulesForTests,
	registerManagementModules,
} from "@/modules/load-modules";
import { LicenseStateService } from "@/services/license-state.service";
import { SystemStateService } from "@/services/system-state.service";

const originalGetEnforcementDecision = LicenseStateService.getEnforcementDecision;
const originalGetSystemStatus = SystemStateService.getSystemStatus;

clearManagementModulesForTests();
registerManagementModules(enterpriseManagementModules);
// Core process with unified manage mount (recommended product path).
const coreApp = await createApiApp("core");

afterEach(() => {
	LicenseStateService.getEnforcementDecision = originalGetEnforcementDecision;
	SystemStateService.getSystemStatus = originalGetSystemStatus;
});

describe("unified manage surface /api/v1/manage/{module}/...", () => {
	test("health reports manage_api_prefix when enterprise modules are registered", async () => {
		const response = await coreApp.request("http://localhost/health");
		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			status: string;
			surface: string;
			manage_api_prefix: string | null;
		};
		expect(body.surface).toBe("core");
		expect(body.manage_api_prefix).toBe(MANAGE_API_PREFIX);
	});

	test(`GET ${MANAGE_API_PREFIX}/system/status returns install and license state`, async () => {
		SystemStateService.getSystemStatus = async () => ({
			id: "default",
			edition: "enterprise",
			first_bootstrap_completed_at: null,
			single_org_mode: false,
			management_enabled: true,
			observability_enabled: true,
			management_web_enabled: true,
			landing_enabled: true,
			created_at: new Date(),
			updated_at: new Date(),
			org_count: 2,
		});
		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: false,
			reason: null,
			state: {
				id: "default",
				status: "active",
				signed_lease: "signed-lease",
				lease_expires_at: new Date(Date.now() + 60_000),
				fingerprint: "fingerprint-1",
				last_verified_at: new Date(),
				last_error_code: null,
				last_error_message: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		const response = await coreApp.request(
			`http://localhost${MANAGE_API_PREFIX}/system/status`,
		);
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			system: { edition: string; org_count: number };
			license: { required: boolean; locked: boolean; state: { status: string } };
		};
		expect(body.system.edition).toBe("enterprise");
		expect(body.system.org_count).toBe(2);
		expect(body.license.required).toBe(true);
		expect(body.license.locked).toBe(false);
		expect(body.license.state.status).toBe("active");
	});

	test("license allowlist works under unified prefix while enterprise stays locked", async () => {
		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: true,
			reason: "ENTERPRISE_LICENSE_EXPIRED",
			state: {
				id: "default",
				status: "expired",
				signed_lease: null,
				lease_expires_at: new Date(Date.now() - 1_000),
				fingerprint: "fingerprint-1",
				last_verified_at: new Date(),
				last_error_code: "ENTERPRISE_LICENSE_EXPIRED",
				last_error_message: "Lease expired.",
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		const [licenseStatus, enterpriseProviders] = await Promise.all([
			coreApp.request(`http://localhost${MANAGE_API_PREFIX}/license/status`),
			coreApp.request(`http://localhost${MANAGE_API_PREFIX}/enterprise/providers`),
		]);

		expect(licenseStatus.status).toBe(200);
		const licenseBody = (await licenseStatus.json()) as { locked: boolean };
		expect(licenseBody.locked).toBe(true);

		expect(enterpriseProviders.status).toBe(423);
		expect(await enterpriseProviders.json()).toMatchObject({
			code: "ENTERPRISE_LICENSE_INVALID",
			reason: "ENTERPRISE_LICENSE_EXPIRED",
		});
	});
});
