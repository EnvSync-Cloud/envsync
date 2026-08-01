import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type PackEntry = {
	path: string;
};

function runPackDryRun(packageDir: string) {
	const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
		cwd: packageDir,
		encoding: "utf8",
	});
	if (result.status !== 0) {
		throw new Error(result.stderr || "npm pack --dry-run failed");
	}
	const match = result.stdout.match(/(\[\s*\{[\s\S]*\])\s*$/);
	if (!match) {
		throw new Error(`npm pack --dry-run did not return JSON output.\n${result.stdout}`);
	}
	return JSON.parse(match[1]) as Array<{ files: PackEntry[] }>;
}

describe("deploy package artifact (OSS)", () => {
	test("pack output contains built artifacts and excludes source files", () => {
		const packageDir = path.resolve(import.meta.dir, "..");
		const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")) as {
			name: string;
			bin: Record<string, string>;
		};
		const [{ files }] = runPackDryRun(packageDir);
		const filePaths = files.map(file => file.path);

		expect(pkg.name).toBe("@envsync-cloud/deploy");
		expect(pkg.bin["envsync-deploy"]).toBe("dist/index.js");
		expect(filePaths).toContain("dist/index.js");
		expect(filePaths).toContain("README.md");
		expect(filePaths.some(file => file.startsWith("src/"))).toBe(false);
	});

	test("built dist owns the engine (no import of deploy-cli / monorepo spawn)", () => {
		const packageDir = path.resolve(import.meta.dir, "..");
		const dist = fs.readFileSync(path.join(packageDir, "dist", "index.js"), "utf8");
		const cli = fs.readFileSync(path.join(packageDir, "dist", "cli.js"), "utf8");
		expect(dist).toContain('ENVSYNC_DEPLOY_FORCE_EDITION = "oss"');
		expect(dist).not.toContain("packages/deploy-cli");
		expect(dist).not.toContain('spawnSync("bun"');
		expect(cli).toContain("envsync-web-oss-static");
		// Source of truth is packages/deploy/src/cli.ts, not deploy-cli
		expect(fs.existsSync(path.join(packageDir, "src", "cli.ts"))).toBe(true);
	});
});
