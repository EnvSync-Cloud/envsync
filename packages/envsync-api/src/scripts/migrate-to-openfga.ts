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

async function main() {
	console.log("Starting OpenFGA data migration...\n");

	// 1. Initialize FGA (creates store + model if needed)
	const fga = await FGAClient.getInstance();
	console.log("FGA client initialized.\n");

	const db = await DB.getInstance();

	// 2. Migrate users → write FGA tuples based on role flags
	console.log("--- Migrating users ---");
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
				console.log(`  Processed ${userCount}/${users.length} users`);
			}
		} catch (err) {
			console.error(`  Failed to migrate user ${user.id}:`, err);
		}
	}
	console.log(`  Migrated ${userCount}/${users.length} users\n`);

	// 3. Migrate apps → write structural tuples (app → org)
	console.log("--- Migrating apps ---");
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
			console.error(`  Failed to migrate app ${app.id}:`, err);
		}
	}
	console.log(`  Migrated ${appCount}/${apps.length} apps\n`);

	// 4. Migrate env_types → write structural tuples (env_type → app, env_type → org)
	console.log("--- Migrating env_types ---");
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
			console.error(`  Failed to migrate env_type ${envType.id}:`, err);
		}
	}
	console.log(`  Migrated ${envTypeCount}/${envTypes.length} env_types\n`);

	// 5. Verification — sample batch checks
	console.log("--- Verification ---");
	if (users.length > 0) {
		const sampleUser = users[0];
		const allowed = await fga.check(
			`user:${sampleUser.id}`,
			"member",
			`org:${sampleUser.org_id}`,
		);
		console.log(
			`  Sample check: user:${sampleUser.id} is member of org:${sampleUser.org_id} => ${allowed}`,
		);
	}

	console.log("\nMigration complete!");
	console.log(`  Users: ${userCount}`);
	console.log(`  Apps: ${appCount}`);
	console.log(`  Env Types: ${envTypeCount}`);

	process.exit(0);
}

main().catch(err => {
	console.error("Migration failed:", err);
	process.exit(1);
});
