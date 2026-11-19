import { describe, expect, test } from "bun:test";

import {
	bootstrapSessionFromMetadata,
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
});
