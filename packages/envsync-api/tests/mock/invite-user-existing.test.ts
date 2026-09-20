import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { InviteService } from "@/services/invite.service";
import { cleanupDB, seedOrg } from "../helpers/db";

beforeEach(async () => {
	await cleanupDB();
});

afterEach(async () => {
	await cleanupDB();
});

describe("InviteService.createUserInvite existing email", () => {
	test("allows inviting a user who already belongs to another org", async () => {
		const tenantA = await seedOrg({ orgName: "Tenant A", orgSlug: "tenant-a", masterEmail: "a@x.y" });
		const tenantB = await seedOrg({ orgName: "Tenant B", orgSlug: "tenant-b", masterEmail: "b@x.y" });

		const invite = await InviteService.createUserInvite("a@x.y", tenantB.org.id, tenantB.roles.developer.id);
		expect(invite.account_exists).toBe(true);
		expect(invite.invite_token.length).toBeGreaterThan(8);

		const view = await InviteService.getUserInviteByCode(invite.invite_token);
		expect(view.org_id).toBe(tenantB.org.id);
		expect(view.email).toBe("a@x.y");
		expect(tenantA.masterUser.email).toBe("a@x.y");
	});

	test("rejects inviting an email that is already a member of this org", async () => {
		const tenantA = await seedOrg({ orgName: "Tenant A", orgSlug: "tenant-a", masterEmail: "a@x.y" });

		await expect(
			InviteService.createUserInvite("a@x.y", tenantA.org.id, tenantA.roles.developer.id),
		).rejects.toMatchObject({
			code: "ALREADY_A_MEMBER",
			statusCode: 409,
		});
	});

	test("still invites a brand-new email", async () => {
		const tenantB = await seedOrg({ orgName: "Tenant B", orgSlug: "tenant-b", masterEmail: "b@x.y" });
		const invite = await InviteService.createUserInvite("new@x.y", tenantB.org.id, tenantB.roles.viewer.id);
		expect(invite.account_exists).toBe(false);
	});
});
