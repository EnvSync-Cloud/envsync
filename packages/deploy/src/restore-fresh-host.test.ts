import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const packageDir = path.resolve(import.meta.dir, "..");
// `bun run test` builds first; the bundled CLI does not need deploy-core built separately.
const cliEntry = path.join(packageDir, "dist", "index.js");

function runRestore(args: string[], root: string) {
	return spawnSync("bun", [cliEntry, "restore", ...args], {
		cwd: packageDir,
		env: {
			...process.env,
			ENVSYNC_DEPLOY_FORCE_EDITION: "oss",
			ENVSYNC_ETC_ROOT: path.join(root, "etc"),
			ENVSYNC_HOST_ROOT: path.join(root, "opt"),
			ENVSYNC_TRAEFIK_STATE_ROOT: path.join(root, "traefik"),
		},
		encoding: "utf8",
	});
}

describe("restore on a host with no deploy config", () => {
	test("dry-run does not require deploy.yaml", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-restore-fresh-"));
		try {
			const result = runRestore(["--dry-run", path.join(root, "missing.tar.gz")], root);
			const output = `${result.stdout}\n${result.stderr}`;
			expect(output).not.toContain("Run setup first");
			expect(result.status).toBe(0);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("reports a missing archive instead of a missing deploy config", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-restore-fresh-"));
		try {
			const archive = path.join(root, "missing.tar.gz");
			const result = runRestore([archive], root);
			const output = `${result.stdout}\n${result.stderr}`;
			expect(output).not.toContain("Run setup first");
			expect(output).toMatch(/ENOENT|no such file/i);
			expect(result.status).not.toBe(0);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
