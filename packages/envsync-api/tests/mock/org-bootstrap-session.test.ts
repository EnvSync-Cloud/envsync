import { describe, expect, test } from "bun:test";

import {
	bootstrapSessionFromMetadata,
	bootstrapSessionUsable,
	peekOrgBootstrapSession,
	rememberOrgBootstrapSession,
} from "@/libs/kms/org-session";

function metadata(values: Record<string, string>) {
	return {
		get(name: string): string[] {
			const value = values[name];
			return value ? [value] : [];
		},
	};
}

describe("miniKMS org bootstrap session", () => {
	test("reads the CreateOrgCA session header and ignores a blank one", () => {
		const parsed = bootstrapSessionFromMetadata(metadata({
			"x-minikms-bootstrap-session": "header.payload.sig",
			"x-minikms-member-serial": "abc123",
		}));
		expect(parsed).toEqual({ token: "header.payload.sig", memberSerial: "abc123" });
		expect(bootstrapSessionFromMetadata(metadata({
			"x-minikms-bootstrap-session": "   ",
			"x-minikms-member-serial": "abc123",
		}))).toBeUndefined();
		expect(bootstrapSessionFromMetadata(undefined)).toBeUndefined();
	});

	test("keeps the first session when a later CreateOrgCA returns no token", () => {
		const orgId = "org-bootstrap-session-test";
		expect(rememberOrgBootstrapSession(orgId, "first-token", "serial-1")).toBe(true);
		expect(rememberOrgBootstrapSession(orgId, "  ", "serial-2")).toBe(false);
		expect(peekOrgBootstrapSession(orgId)).toEqual({
			token: "first-token",
			memberSerial: "serial-1",
		});
		expect(rememberOrgBootstrapSession(orgId, "second-token", "serial-3")).toBe(true);
		expect(peekOrgBootstrapSession(orgId)?.token).toBe("second-token");
	});

	test("drops a bootstrap session that expires within a minute", () => {
		const expired = `h.${Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url")}.s`;
		const fresh = `h.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.s`;
		expect(bootstrapSessionUsable(expired)).toBe(false);
		expect(bootstrapSessionUsable(fresh)).toBe(true);
		expect(bootstrapSessionUsable("not-a-jwt")).toBe(true);
		const orgId = "org-bootstrap-session-expired";
		expect(rememberOrgBootstrapSession(orgId, expired, "serial")).toBe(true);
		expect(peekOrgBootstrapSession(orgId)).toBeUndefined();
	});
});
