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

describe("deploy-enterprise package artifact", () => {
	test("pack output uses enterprise bin name and excludes source", () => {
		const packageDir = path.resolve(import.meta.dir, "..");
		const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8")) as {
			name: string;
			bin: Record<string, string>;
			dependencies?: Record<string, string>;
			publishConfig?: { access?: string; registry?: string };
		};
		const [{ files }] = runPackDryRun(packageDir);
		const filePaths = files.map(file => file.path);

		expect(pkg.name).toBe("@envsync-cloud/deploy-enterprise");
		expect(pkg.bin["envsync-deploy-enterprise"]).toBe("./dist/index.js");
		expect(pkg.bin["envsync-deploy"]).toBeUndefined();
		// Open-core: EE depends on OSS engine package (or bundles it); never the reverse.
		expect(pkg.dependencies?.["@envsync-cloud/deploy"]).toBeTruthy();
		expect(pkg.publishConfig?.access).toBe("restricted");
		expect(pkg.publishConfig?.registry).toContain("npm.pkg.github.com");
		expect(filePaths).toContain("dist/index.js");
		expect(filePaths).toContain("README.md");
		expect(filePaths).toContain("LICENSE");
		expect(filePaths.some(file => file.startsWith("src/"))).toBe(false);
	});

	test("enterprise entry forces edition and does not own the engine source tree", () => {
		const packageDir = path.resolve(import.meta.dir, "..");
		const entry = fs.readFileSync(path.join(packageDir, "src", "index.ts"), "utf8");
		const dist = fs.readFileSync(path.join(packageDir, "dist", "index.js"), "utf8");
		expect(entry).toContain('ENVSYNC_DEPLOY_FORCE_EDITION = "enterprise"');
		expect(entry).toContain("@envsync-cloud/deploy/cli");
		// Thin package: no multi-thousand-line engine in deploy-cli/src
		expect(fs.existsSync(path.join(packageDir, "src", "cli.ts"))).toBe(false);
		expect(dist).toContain("enterprise");
	});
});
