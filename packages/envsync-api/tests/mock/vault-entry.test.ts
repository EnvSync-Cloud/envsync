import { beforeAll, describe, expect, test } from "bun:test";

import { ForbiddenError } from "@/libs/errors";
import { EnvService } from "@/services/env.service";
import { VaultEntryService } from "@/services/vault_entry.service";
import { seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let appId: string;
let foreignEnvTypeId: string;

beforeAll(async () => {
	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
	});
	const app = await seedApp(seed.org.id);
	appId = app.id;

	const other = await seedOrg();
	const otherApp = await seedApp(other.org.id);
	const foreignEnvType = await seedEnvType(other.org.id, otherApp.id);
	foreignEnvTypeId = foreignEnvType.id;
});

describe("VaultEntryService.assertMutableEnvType", () => {
	test("rejects a cross-org environment type", async () => {
		await expect(
			VaultEntryService.assertMutableEnvType({
				env_type_id: foreignEnvTypeId,
				org_id: seed.org.id,
				app_id: appId,
				user_id: seed.masterUser.id,
			}),
		).rejects.toBeInstanceOf(ForbiddenError);
	});

	test("direct mutate of a protected env requires a change request", async () => {
		const envType = await seedEnvType(seed.org.id, appId, { name: "production", isProtected: true });
		await MockFGAClient.writeTuples([
			{ user: `app:${appId}`, relation: "app", object: `env_type:${envType.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envType.id}` },
		]);

		await expect(
			EnvService.createEnv({
				key: "DIRECT_BLOCKED",
				value: "nope",
				app_id: appId,
				org_id: seed.org.id,
				env_type_id: envType.id,
				user_id: seed.masterUser.id,
			}),
		).rejects.toMatchObject({
			code: "PROTECTED_ENV_REQUIRES_CHANGE_REQUEST",
			statusCode: 409,
		});
	});

	test("change-request apply may mutate a protected env", async () => {
		const envType = await seedEnvType(seed.org.id, appId, { name: "staging", isProtected: true });
		await MockFGAClient.writeTuples([
			{ user: `app:${appId}`, relation: "app", object: `env_type:${envType.id}` },
			{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envType.id}` },
		]);

		const created = await EnvService.createEnv(
			{
				key: "CR_ALLOWED",
				value: "yes",
				app_id: appId,
				org_id: seed.org.id,
				env_type_id: envType.id,
				user_id: seed.masterUser.id,
			},
			{ allowProtected: true },
		);
		expect(created.id).toContain("CR_ALLOWED");
	});
});
