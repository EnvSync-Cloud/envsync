import { afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";

import * as identity from "@/helpers/identity";
import { AuditLogService } from "@/services/audit_log.service";
import { seedOrg, seedUser } from "../helpers/db";
import { testRequest } from "../helpers/request";

let user: Awaited<ReturnType<typeof seedUser>>;
const password = "new-test-password";
const enrollment = {
	otpauth_url: "otpauth://totp/EnvSync:test?secret=TESTONLY",
	qr_image: "data:image/png;base64,dGVzdA==",
	secret: "TESTONLY",
};

beforeAll(async () => {
	const seed = await seedOrg();
	user = await seedUser(seed.org.id, seed.roles.viewer.id, { fullName: "Ada van Example" });
});

afterEach(() => {
	// Bun's local spies are restored between cases; the shared preload remains installed.
	for (const restore of restores.splice(0)) restore();
});

const restores: Array<() => void> = [];
function track<T extends { mockRestore: () => void }>(spy: T): T {
	restores.push(() => spy.mockRestore());
	return spy;
}

function account(path: string, body?: unknown) {
	return testRequest(`/api/user/me/${path}`, {
		method: path === "security" ? "GET" : "POST",
		token: user.token,
		body,
	});
}

describe("account security routes", () => {
	test.each(["security", "password", "mfa/setup", "mfa/confirm", "mfa/disable"])(
		"requires authentication for %s",
		async path => {
			const response = await testRequest(`/api/user/me/${path}`, {
				method: path === "security" ? "GET" : "POST",
			});
			expect(response.status).toBe(401);
		},
	);

	test.each([true, false])("reports directory settings (password configured: %s)", async configured => {
		const hasPassword = track(spyOn(identity, "directoryUserHasPassword")).mockResolvedValue(configured);
		const mfaStatus = track(spyOn(identity, "getDirectoryMfaEnabled")).mockResolvedValue(!configured);

		const response = await account("security");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			first_name: "Ada",
			last_name: "van Example",
			email: user.email,
			has_password: configured,
			mfa_enabled: !configured,
			sign_in_methods: configured ? [{ id: "password", name: "Password", linked: true }] : [],
		});
		expect(hasPassword).toHaveBeenCalledWith(user.authServiceId);
		expect(mfaStatus).toHaveBeenCalledWith(user.authServiceId);
	});

	test("reports a directory lookup failure instead of claiming MFA is off", async () => {
		track(spyOn(identity, "getDirectoryMfaEnabled")).mockRejectedValue(new Error("directory unavailable"));
		const response = await account("security");
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Sign-in settings could not be loaded." });
	});

	test.each([7, 129])("rejects a password of length %i before calling the directory", async length => {
		const lookup = track(spyOn(identity, "directoryUserHasPassword"));
		const response = await account("password", { password: "a".repeat(length) });
		expect(response.status).toBe(400);
		expect(lookup).not.toHaveBeenCalled();
	});

	test("requires the reset flow when a password already exists", async () => {
		track(spyOn(identity, "directoryUserHasPassword")).mockResolvedValue(true);
		const setPassword = track(spyOn(identity, "setDirectoryUserPassword"));
		const response = await account("password", { password });
		expect(response.status).toBe(409);
		expect(await response.json()).toMatchObject({ code: "PASSWORD_ALREADY_SET" });
		expect(setPassword).not.toHaveBeenCalled();
	});

	test.each([8, 128])("sets a first password of length %i without including it in audit details", async length => {
		const firstPassword = "p".repeat(length);
		track(spyOn(identity, "directoryUserHasPassword")).mockResolvedValue(false);
		const setPassword = track(spyOn(identity, "setDirectoryUserPassword")).mockResolvedValue(undefined);
		const audit = track(spyOn(AuditLogService, "notifyAuditSystem"));
		const response = await account("password", { password: firstPassword });

		expect(response.status).toBe(200);
		expect(setPassword).toHaveBeenCalledWith(user.authServiceId, firstPassword);
		expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "password_set", user_id: user.id }));
		expect(JSON.stringify(audit.mock.calls)).not.toContain(firstPassword);
	});

	test("returns a public error if the directory rejects a new password", async () => {
		track(spyOn(identity, "directoryUserHasPassword")).mockResolvedValue(false);
		track(spyOn(identity, "setDirectoryUserPassword")).mockRejectedValue(new Error("directory policy"));
		const audit = track(spyOn(AuditLogService, "notifyAuditSystem"));
		const response = await account("password", { password });
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Choose a different password.", code: "PASSWORD_REJECTED" });
		expect(audit).not.toHaveBeenCalled();
	});

	test("starts enrollment for the signed-in user without auditing the enrollment secret", async () => {
		const setup = track(spyOn(identity, "beginDirectoryMfa")).mockResolvedValue(enrollment);
		const audit = track(spyOn(AuditLogService, "notifyAuditSystem"));
		const response = await account("mfa/setup");

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(enrollment);
		expect(setup).toHaveBeenCalledWith(user.authServiceId);
		expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "mfa_enrollment_started", user_id: user.id }));
		expect(JSON.stringify(audit.mock.calls)).not.toContain(enrollment.secret);
	});

	test.each(["12345", "123456789", "12345x", 123456])("rejects malformed MFA code %s", async code => {
		const confirm = track(spyOn(identity, "confirmDirectoryMfa"));
		const response = await account("mfa/confirm", { code });
		expect(response.status).toBe(400);
		expect(confirm).not.toHaveBeenCalled();
	});

	test.each(["012345", "01234567"])("preserves leading zeros when confirming code %s", async code => {
		const confirm = track(spyOn(identity, "confirmDirectoryMfa")).mockResolvedValue(undefined);
		const response = await account("mfa/confirm", { code });
		expect(response.status).toBe(200);
		expect(confirm).toHaveBeenCalledWith(user.authServiceId, code);
	});

	test("does not audit a rejected MFA confirmation as successful", async () => {
		track(spyOn(identity, "confirmDirectoryMfa")).mockRejectedValue(new Error("invalid code"));
		const audit = track(spyOn(AuditLogService, "notifyAuditSystem"));
		const response = await account("mfa/confirm", { code: "123456" });
		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ code: "MFA_CODE_INVALID" });
		expect(audit).not.toHaveBeenCalled();
	});

	test("rejects MFA disable without a password", async () => {
		const disable = track(spyOn(identity, "disableDirectoryMfa"));
		const response = await account("mfa/disable");
		expect(response.status).toBe(400);
		expect(disable).not.toHaveBeenCalled();
	});

	test("does not disable MFA when the password is rejected", async () => {
		track(spyOn(identity, "passwordGrantLogin")).mockRejectedValue(new Error("invalid_grant"));
		const disable = track(spyOn(identity, "disableDirectoryMfa"));
		const response = await account("mfa/disable", { password: "wrong-password" });
		expect(response.status).toBe(401);
		expect(await response.json()).toMatchObject({ code: "STEP_UP_FAILED" });
		expect(disable).not.toHaveBeenCalled();
	});

	test("disables MFA after the current password checks out", async () => {
		const currentPassword = "current-password";
		const login = track(spyOn(identity, "passwordGrantLogin")).mockResolvedValue({
			access_token: "step-up",
		} as Awaited<ReturnType<typeof identity.passwordGrantLogin>>);
		const disable = track(spyOn(identity, "disableDirectoryMfa")).mockResolvedValue(undefined);
		const audit = track(spyOn(AuditLogService, "notifyAuditSystem"));
		const response = await account("mfa/disable", { password: currentPassword });
		expect(response.status).toBe(200);
		expect(login).toHaveBeenCalledWith(
			user.email,
			currentPassword,
			expect.any(String),
			expect.any(String),
		);
		expect(disable).toHaveBeenCalledWith(user.authServiceId);
		expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: "mfa_disabled", user_id: user.id }));
		expect(JSON.stringify(audit.mock.calls)).not.toContain(currentPassword);
	});

	test("returns a public error when authenticator setup fails", async () => {
		track(spyOn(identity, "beginDirectoryMfa")).mockRejectedValue(new Error("directory unavailable"));
		const response = await account("mfa/setup");
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Authenticator setup could not start." });
	});

	test("returns a public error when MFA disable fails after the password check", async () => {
		track(spyOn(identity, "passwordGrantLogin")).mockResolvedValue({
			access_token: "step-up",
		} as Awaited<ReturnType<typeof identity.passwordGrantLogin>>);
		track(spyOn(identity, "disableDirectoryMfa")).mockRejectedValue(new Error("directory unavailable"));
		const response = await account("mfa/disable", { password: "current-password" });
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "The authenticator could not be turned off." });
	});
});
