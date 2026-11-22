import { beforeAll, expect, test } from "bun:test";

import { rsaLayerDecrypt, smartEncrypt } from "@/helpers/key-store";
import { AppService } from "@/services/app.service";
import { getDB, seedApp, seedOrg } from "../helpers/db";

let orgId: string;
beforeAll(async () => {
	orgId = (await seedOrg()).org.id;
});

test("provisions a managed key for a legacy project and reuses it on stale reads", async () => {
	const { id } = await seedApp(orgId, { enableSecrets: true });
	const legacy = { id, org_id: orgId, public_key: null };

	const key = await AppService.ensureEncryptionKey(legacy);
	const stored = await (await getDB())
		.selectFrom("app")
		.select(["public_key", "private_key", "is_managed_secret"])
		.where("id", "=", id)
		.executeTakeFirstOrThrow();

	expect(stored.public_key).toBe(key);
	expect(stored.is_managed_secret).toBe(true);
	expect(stored.private_key).not.toContain("BEGIN PRIVATE KEY");
	const privateKey = await AppService.getManagedAppPrivateKey(id);
	expect(rsaLayerDecrypt(smartEncrypt("fixture-value", key), privateKey)).toBe("fixture-value");
	expect(await AppService.ensureEncryptionKey(legacy)).toBe(key);
});

test("returns the same usable key to concurrent callers backfilling a legacy project", async () => {
	const { id } = await seedApp(orgId, { enableSecrets: true });
	const legacy = { id, org_id: orgId, public_key: null };

	const [first, second] = await Promise.all([
		AppService.ensureEncryptionKey(legacy),
		AppService.ensureEncryptionKey(legacy),
	]);

	expect(first).toBe(second);
	const privateKey = await AppService.getManagedAppPrivateKey(id);
	expect(rsaLayerDecrypt(smartEncrypt("fixture-value", second), privateKey)).toBe("fixture-value");
});
