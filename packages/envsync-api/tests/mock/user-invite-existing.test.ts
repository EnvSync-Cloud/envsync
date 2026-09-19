import { beforeAll, describe, expect, test } from "bun:test";

import { InviteService } from "@/services/invite.service";
import { seedOrg, type SeedOrgResult } from "../helpers/db";

let source: SeedOrgResult;
let target: SeedOrgResult;

beforeAll(async () => {
	source = await seedOrg({ orgSlug: `invite-src-${Date.now()}` });
	target = await seedOrg({ orgSlug: `invite-dst-${Date.now()}` });
});

describe("invite existing EnvSync accounts", () => {
	test("allows inviting an email that already has a membership in another org", async () => {
		const result = await InviteService.createUserInvite(
			source.masterUser.email,
			target.org.id,
			target.roles.developer.id,
		);
		expect(result.invite_token).toBeTruthy();
		expect(result.id).toBeTruthy();
	});

	test("rejects inviting someone who is already in this organization", async () => {
		await expect(
			InviteService.createUserInvite(
				target.masterUser.email,
				target.org.id,
				target.roles.developer.id,
			),
		).rejects.toMatchObject({ code: "ALREADY_A_MEMBER" });
	});
});
