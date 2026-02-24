/**
 * One-time migration script to seed OpenFGA with existing data.
 *
 * Run with: bun run src/scripts/migrate-to-openfga.ts
 *
 * This script is idempotent — WriteTuples is a no-op for already-existing tuples.
 */

import { DB } from "@/libs/db";
import { FGAClient } from "@/libs/openfga";
import { AuthorizationService } from "@/services/authorization.service";
import infoLogs, { LogTypes } from "@/libs/logger";

async function main() {
	infoLogs("Starting OpenFGA data migration...", LogTypes.LOGS, "Migration:OpenFGA");

	// 1. Initialize FGA (creates store + model if needed)
	const fga = await FGAClient.getInstance();
	infoLogs("FGA client initialized.", LogTypes.LOGS, "Migration:OpenFGA");

	const db = await DB.getInstance();

	// 2. Migrate users → write FGA tuples based on role flags
	infoLogs("--- Migrating users ---", LogTypes.LOGS, "Migration:OpenFGA");
	const users = await db
		.selectFrom("users")
		.select(["id", "org_id", "role_id"])
		.execute();

	let userCount = 0;
	for (const user of users) {
		try {
			await AuthorizationService.assignRoleToUser(user.id, user.org_id, user.role_id);
			userCount++;
			if (userCount % 50 === 0) {
				infoLogs(`  Processed ${userCount}/${users.length} users`, LogTypes.LOGS, "Migration:OpenFGA");
			}
		} catch (err) {
			infoLogs(`  Failed to migrate user ${user.id}: ${err}`, LogTypes.ERROR, "Migration:OpenFGA");
		}
	}
	infoLogs(`  Migrated ${userCount}/${users.length} users`, LogTypes.LOGS, "Migration:OpenFGA");

	// 3. Migrate apps → write structural tuples (app → org)
	infoLogs("--- Migrating apps ---", LogTypes.LOGS, "Migration:OpenFGA");
	const apps = await db
		.selectFrom("app")
		.select(["id", "org_id"])
		.execute();

	let appCount = 0;
	for (const app of apps) {
		try {
			await AuthorizationService.writeAppOrgRelation(app.id, app.org_id);
			appCount++;
		} catch (err) {
			infoLogs(`  Failed to migrate app ${app.id}: ${err}`, LogTypes.ERROR, "Migration:OpenFGA");
		}
	}
	infoLogs(`  Migrated ${appCount}/${apps.length} apps`, LogTypes.LOGS, "Migration:OpenFGA");

	// 4. Migrate env_types → write structural tuples (env_type → app, env_type → org)
	infoLogs("--- Migrating env_types ---", LogTypes.LOGS, "Migration:OpenFGA");
	const envTypes = await db
		.selectFrom("env_type")
		.select(["id", "app_id", "org_id"])
		.execute();

	let envTypeCount = 0;
	for (const envType of envTypes) {
		try {
			await AuthorizationService.writeEnvTypeRelations(envType.id, envType.app_id, envType.org_id);
			envTypeCount++;
		} catch (err) {
			infoLogs(`  Failed to migrate env_type ${envType.id}: ${err}`, LogTypes.ERROR, "Migration:OpenFGA");
		}
	}
	infoLogs(`  Migrated ${envTypeCount}/${envTypes.length} env_types`, LogTypes.LOGS, "Migration:OpenFGA");

	// 5. Verification — sample batch checks
	infoLogs("--- Verification ---", LogTypes.LOGS, "Migration:OpenFGA");
	if (users.length > 0) {
		const sampleUser = users[0];
		const allowed = await fga.check(
			`user:${sampleUser.id}`,
			"member",
			`org:${sampleUser.org_id}`,
		);
		infoLogs(
			`  Sample check: user:${sampleUser.id} is member of org:${sampleUser.org_id} => ${allowed}`,
			LogTypes.LOGS,
			"Migration:OpenFGA",
		);
	}

	infoLogs("Migration complete!", LogTypes.LOGS, "Migration:OpenFGA");
	infoLogs(`  Users: ${userCount}`, LogTypes.LOGS, "Migration:OpenFGA");
	infoLogs(`  Apps: ${appCount}`, LogTypes.LOGS, "Migration:OpenFGA");
	infoLogs(`  Env Types: ${envTypeCount}`, LogTypes.LOGS, "Migration:OpenFGA");

	process.exit(0);
}

main().catch(err => {
	infoLogs(`Migration failed: ${err}`, LogTypes.ERROR, "Migration:OpenFGA");
	process.exit(1);
});
