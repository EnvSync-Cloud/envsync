/**
 * E2E test preload — zero mock.module() calls.
 *
 * All services are real:
 * - JWT verification → real Keycloak JWKS endpoint
 * - miniKMS → real miniKMS for encryption, PKI, vault, sessions
 * - OpenFGA → real OpenFGA (auto-bootstraps store+model)
 * - Mail → real Mailpit SMTP
 * - Keycloak → real Keycloak for user management + token issuance
 *
 * Prerequisites:
 *   1. Run `bun run e2e:init` (or `bun run scripts/e2e-setup.ts init`) to set up services
 *   2. Docker services must be running (postgres, redis, minikms, openfga, mailpit, keycloak)
 *
 * Usage: TEST_MODE=e2e bun test tests/e2e --preload tests/e2e/helpers/real-setup.ts
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ensureE2EEnv } from "./bootstrap-env";

ensureE2EEnv();

ensureMiniKmsSchema();

// ── 4. Initialize cache ─────────────────────────────────────────────
const { CacheClient } = await import("@/libs/cache");
CacheClient.init("development");

// ── 5. Initialize DB and run migrations ─────────────────────────────
const { DB } = await import("@/libs/db");
await DB.getInstance();
console.log("[E2E Setup] Database initialized and migrations applied.");
console.log("[E2E Setup] All services are REAL — zero mock.module() calls.");

function ensureMiniKmsSchema(): void {
	const monorepoRoot = findMonorepoRoot();
	const dbUser = process.env.MINIKMS_DB_USER ?? "postgres";

	const check = spawnSync(
		"docker",
		[
			"compose",
			"exec",
			"-T",
			"minikms_db",
			"psql",
			"-U",
			dbUser,
			"-d",
			"minikms",
			"-tAc",
			"SELECT to_regclass('public.certificates') IS NOT NULL",
		],
		{ cwd: monorepoRoot, encoding: "utf8" },
	);
	if (check.status === 0 && check.stdout.trim() === "t") {
		return;
	}

	const migrate = spawnSync(
		"docker",
		["compose", "run", "--rm", "minikms_migrate"],
		{ cwd: monorepoRoot, stdio: "inherit", env: process.env },
	);
	if (migrate.status !== 0) {
		throw new Error("miniKMS migration failed during E2E preload");
	}

	const restart = spawnSync("docker", ["compose", "restart", "minikms"], {
		cwd: monorepoRoot,
		stdio: "inherit",
		env: process.env,
	});
	if (restart.status !== 0) {
		throw new Error("Failed to restart miniKMS after applying schema");
	}
	console.log("[E2E Setup] miniKMS schema applied and service restarted.");
}

function findMonorepoRoot(): string {
	let dir = path.resolve(import.meta.dir, "../../../../../");
	for (;;) {
		if (fs.existsSync(path.join(dir, "docker-compose.yaml"))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			throw new Error("Could not find monorepo root from E2E preload");
		}
		dir = parent;
	}
}
