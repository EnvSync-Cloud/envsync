import type { Kysely } from "kysely";

async function load() {
	try {
		return await import("../../../../../envsync-enterprise/src/migrations/025_saml_sso_login_path.ts");
	} catch {
		return null;
	}
}

export async function up(db: Kysely<unknown>) {
	const ee = await load();
	if (!ee) return;
	return ee.up(db);
}

export async function down(db: Kysely<unknown>) {
	const ee = await load();
	if (!ee) return;
	return ee.down(db);
}
