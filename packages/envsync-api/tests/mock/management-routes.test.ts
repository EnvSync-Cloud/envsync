import { afterEach, describe, expect, test } from "bun:test";

import { enterpriseManagementModules } from "envsync-enterprise";

import { createApiApp } from "@/app/factory";
import { MANAGE_API_PREFIX, registerManagementModules } from "@/modules/load-modules";
import { LicenseStateService } from "@/services/license-state.service";
import { SystemStateService } from "@/services/system-state.service";

const originalGetEnforcementDecision = LicenseStateService.getEnforcementDecision;
const originalActivateLicense = LicenseStateService.activateLicense;
const originalVerifyLicenseNow = LicenseStateService.verifyLicenseNow;
const originalGetSystemStatus = SystemStateService.getSystemStatus;

registerManagementModules(enterpriseManagementModules);
const managementApp = await createApiApp("management");

afterEach(() => {
	LicenseStateService.getEnforcementDecision = originalGetEnforcementDecision;
	LicenseStateService.activateLicense = originalActivateLicense;
	LicenseStateService.verifyLicenseNow = originalVerifyLicenseNow;
	SystemStateService.getSystemStatus = originalGetSystemStatus;
});

describe("management process surface (/api/v1/manage/...)", () => {
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

		const response = await managementApp.request(
			`http://localhost${MANAGE_API_PREFIX}/system/status`,
		);
		expect(response.status).toBe(200);

		const body = await response.json() as {
			system: { edition: string; org_count: number };
			license: { required: boolean; locked: boolean; state: { status: string } };
		};
		expect(body.system.edition).toBe("enterprise");
		expect(body.system.org_count).toBe(2);
		expect(body.license.required).toBe(true);
		expect(body.license.locked).toBe(false);
		expect(body.license.state.status).toBe("active");
	});

	test("license endpoints stay reachable while locked and enterprise routes return 423", async () => {
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
			managementApp.request(`http://localhost${MANAGE_API_PREFIX}/license/status`),
			managementApp.request(`http://localhost${MANAGE_API_PREFIX}/enterprise/providers`),
		]);

		expect(licenseStatus.status).toBe(200);
		const licenseBody = await licenseStatus.json() as { locked: boolean };
		expect(licenseBody.locked).toBe(true);

		expect(enterpriseProviders.status).toBe(423);
		expect(await enterpriseProviders.json()).toMatchObject({
			code: "ENTERPRISE_LICENSE_INVALID",
			reason: "ENTERPRISE_LICENSE_EXPIRED",
		});
	});

	test(`POST ${MANAGE_API_PREFIX}/license/activate and /verify delegate to the service`, async () => {
		const activatedState = {
			id: "default",
			status: "active" as const,
			signed_lease: "activated-lease",
			lease_expires_at: new Date(Date.now() + 60_000),
			fingerprint: "fingerprint-1",
			last_verified_at: new Date(),
			last_error_code: null,
			last_error_message: null,
			created_at: new Date(),
			updated_at: new Date(),
		};
		const verifiedState = {
			...activatedState,
			signed_lease: "verified-lease",
		};

		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: false,
			reason: null,
			state: activatedState,
		});
		LicenseStateService.activateLicense = async () => activatedState;
		LicenseStateService.verifyLicenseNow = async () => verifiedState;

		const [activateResponse, verifyResponse] = await Promise.all([
			managementApp.request(`http://localhost${MANAGE_API_PREFIX}/license/activate`, {
				method: "POST",
			}),
			managementApp.request(`http://localhost${MANAGE_API_PREFIX}/license/verify`, {
				method: "POST",
			}),
		]);

		expect(activateResponse.status).toBe(200);
		expect(verifyResponse.status).toBe(200);
		expect(await activateResponse.json()).toMatchObject({
			message: "License activated.",
			state: {
				signed_lease: "activated-lease",
			},
		});
		expect(await verifyResponse.json()).toMatchObject({
			message: "License verified.",
			state: {
				signed_lease: "verified-lease",
			},
		});
	});
});
