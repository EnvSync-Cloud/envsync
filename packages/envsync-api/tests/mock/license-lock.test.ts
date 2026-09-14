import { afterEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";

import { enterpriseLicenseLockMiddleware } from "@/middlewares/license-lock.middleware";
import { LicenseStateService } from "@/services/license-state.service";

const originalGetEnforcementDecision = LicenseStateService.getEnforcementDecision;

afterEach(() => {
	LicenseStateService.getEnforcementDecision = originalGetEnforcementDecision;
});

describe("enterpriseLicenseLockMiddleware", () => {
	test("allows explicitly allowlisted paths even when the product is locked", async () => {
		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: true,
			reason: "ENTERPRISE_LICENSE_EXPIRED",
			state: {
				id: "default",
				status: "expired",
				signed_lease: null,
				lease_expires_at: null,
				fingerprint: null,
				last_verified_at: null,
				last_error_code: "ENTERPRISE_LICENSE_EXPIRED",
				last_error_message: "Lease expired.",
				created_at: null,
				updated_at: null,
			},
		});

		const app = new Hono();
		app.use("/api/*", enterpriseLicenseLockMiddleware(["/api/system/status", "/api/license/status"]));
		app.get("/api/system/status", ctx => ctx.json({ ok: true }));
		app.get("/api/license/status", ctx => ctx.json({ ok: true }));
		app.get("/api/license/status/details", ctx => ctx.json({ ok: true }));
		app.get("/api/org", ctx => ctx.json({ ok: true }));

		expect((await app.request("http://localhost/api/system/status")).status).toBe(200);
		expect((await app.request("http://localhost/api/license/status")).status).toBe(200);
		expect((await app.request("http://localhost/api/license/status/details")).status).toBe(200);

		const lockedResponse = await app.request("http://localhost/api/org");
		expect(lockedResponse.status).toBe(423);
		expect(await lockedResponse.json()).toMatchObject({
			code: "ENTERPRISE_LICENSE_INVALID",
			reason: "ENTERPRISE_LICENSE_EXPIRED",
		});
	});

	test("allows SAML ACS and SSO prefixes under lock", async () => {
		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: true,
			reason: "ENTERPRISE_LICENSE_EXPIRED",
			state: {
				id: "default",
				status: "expired",
				signed_lease: null,
				lease_expires_at: null,
				fingerprint: null,
				last_verified_at: null,
				last_error_code: "ENTERPRISE_LICENSE_EXPIRED",
				last_error_message: "Lease expired.",
				created_at: null,
				updated_at: null,
			},
		});

		const app = new Hono();
		app.use("/api/*", enterpriseLicenseLockMiddleware(["/api/saml/metadata", "/api/saml/acs", "/api/saml/sso"]));
		app.get("/api/saml/metadata/org-1", ctx => ctx.json({ ok: true }));
		app.post("/api/saml/acs/org-1", ctx => ctx.json({ ok: true }));
		app.get("/api/saml/sso/acme", ctx => ctx.json({ ok: true }));
		app.get("/api/org", ctx => ctx.json({ ok: true }));

		expect((await app.request("http://localhost/api/saml/metadata/org-1")).status).toBe(200);
		expect((await app.request("http://localhost/api/saml/acs/org-1", { method: "POST" })).status).toBe(200);
		expect((await app.request("http://localhost/api/saml/sso/acme")).status).toBe(200);
		expect((await app.request("http://localhost/api/org")).status).toBe(423);
	});

	test("passes through when the deployment is not locked", async () => {
		LicenseStateService.getEnforcementDecision = async () => ({
			required: true,
			locked: false,
			reason: null,
			state: {
				id: "default",
				status: "active",
				signed_lease: "lease",
				lease_expires_at: new Date(Date.now() + 60_000),
				fingerprint: "fp",
				last_verified_at: new Date(),
				last_error_code: null,
				last_error_message: null,
				created_at: new Date(),
				updated_at: new Date(),
			},
		});

		const app = new Hono();
		app.use("/api/*", enterpriseLicenseLockMiddleware(["/api/system/status"]));
		app.get("/api/org", ctx => ctx.json({ ok: true }));

		const response = await app.request("http://localhost/api/org");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});
});
