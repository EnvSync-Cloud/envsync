import { expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT_PATH = path.join(import.meta.dir, "bump-release-version.ts");
const REAL_ROOT = path.resolve(import.meta.dir, "..");

/**
 * Duplicated from scripts/bump-release-version.ts on purpose.
 * The bump script stays a CLI with no exports; this list is the lockstep contract.
 * packages/envsync-analytics is intentionally not on the train.
 */
const PACKAGE_REL_PATHS = [
	"package.json",
	"packages/deploy/package.json",
	"packages/deploy-cli/package.json",
	"packages/deploy-core/package.json",
	"packages/envsync-api/package.json",
	"packages/envsync-enterprise/package.json",
	"packages/envsync-enterprise-web/package.json",
	"packages/envsync-kernel/package.json",
	"packages/envsync-ui/package.json",
	"apps/envsync-landing/package.json",
	"apps/envsync-web/package.json",
	"sdks/envsync-ts-sdk/package.json",
] as const;

const OPENAPI_REL_PATHS = [
	"sdks/envsync-ts-sdk/openapi.json",
	"sdks/envsync-go-sdk/openapi.json",
] as const;

const ANALYTICS_REL_PATH = "packages/envsync-analytics/package.json";
const LOCKSTEP_REL_PATHS = [...PACKAGE_REL_PATHS, ...OPENAPI_REL_PATHS];

interface RunResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

function decode(value: unknown): string {
	if (typeof value === "string") return value;
	if (value instanceof Uint8Array) return new TextDecoder().decode(value);
	return "";
}

function packageVersionLine(version: string): string {
	return `    "version": "${version}",`;
}

function openApiVersionLine(version: string): string {
	return `        "version": "${version}"`;
}

function renderPackage(version: string): string {
	return [
		"{",
		'    "name": "lockstep",',
		'    "files": [',
		'        "src"',
		"    ],",
		'    "scripts": {',
		'        "build": "echo ok"',
		"    },",
		'    "sideEffects": false,',
		'    "config": {',
		'        "version": "nested-stay"',
		"    },",
		packageVersionLine(version),
		'    "private": true',
		"}",
		"",
	].join("\n");
}

function renderOpenApi(version: string): string {
	return [
		"{",
		'    "openapi": "3.1.0",',
		'    "info": {',
		'        "title": "EnvSync API",',
		'        "description": "docs with \\"version\\" word and {braces}",',
		openApiVersionLine(version),
		"    },",
		'    "components": {',
		'        "schemas": {',
		'            "Widget": {',
		'                "properties": {',
		'                    "version": {',
		'                        "type": "string",',
		'                        "example": "leave-me"',
		"                    }",
		"                }",
		"            }",
		"        }",
		"    }",
		"}",
		"",
	].join("\n");
}

function writeRel(root: string, relPath: string, contents: string): void {
	const absPath = path.join(root, relPath);
	fs.mkdirSync(path.dirname(absPath), { recursive: true });
	fs.writeFileSync(absPath, contents);
}

function seed(root: string, version: string, overrides: Record<string, string> = {}): void {
	for (const relPath of PACKAGE_REL_PATHS) {
		writeRel(root, relPath, renderPackage(overrides[relPath] ?? version));
	}
	for (const relPath of OPENAPI_REL_PATHS) {
		writeRel(root, relPath, renderOpenApi(overrides[relPath] ?? version));
	}
	writeRel(
		root,
		ANALYTICS_REL_PATH,
		`${JSON.stringify({ name: "envsync-analytics", version: "0.20.12" }, null, 2)}\n`,
	);
}

function snapshot(root: string): Map<string, string> {
	const relPaths = [...LOCKSTEP_REL_PATHS, ANALYTICS_REL_PATH];
	return new Map(relPaths.map(relPath => [relPath, fs.readFileSync(path.join(root, relPath), "utf8")]));
}

function expectUnchanged(root: string, before: Map<string, string>): void {
	for (const [relPath, contents] of before) {
		expect(fs.readFileSync(path.join(root, relPath), "utf8")).toBe(contents);
	}
}

function runBump(root: string, args: string[]): RunResult {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (typeof value === "string") env[key] = value;
	}
	env.RELEASE_BUMP_ROOT = root;
	const result = Bun.spawnSync(["bun", "run", SCRIPT_PATH, ...args], {
		cwd: root,
		env,
		stdout: "pipe",
		stderr: "pipe",
	});
	return {
		exitCode: result.exitCode ?? 1,
		stdout: decode(result.stdout),
		stderr: decode(result.stderr),
	};
}

function expectSuccess(result: RunResult): void {
	if (result.exitCode !== 0) {
		throw new Error(`expected exit 0, got ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
	}
}

function expectTrain(root: string, version: string): void {
	for (const relPath of PACKAGE_REL_PATHS) {
		const parsed = JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8")) as {
			version: string;
			config: { version: string };
		};
		expect(parsed.version, relPath).toBe(version);
		expect(parsed.config.version, relPath).toBe("nested-stay");
	}
	for (const relPath of OPENAPI_REL_PATHS) {
		const parsed = JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8")) as {
			info: { version: string; description: string };
			components: { schemas: { Widget: { properties: { version: { example: string } } } } };
		};
		expect(parsed.info.version, relPath).toBe(version);
		expect(parsed.info.description).toContain("{braces}");
		expect(parsed.components.schemas.Widget.properties.version.example).toBe("leave-me");
	}
	const analytics = JSON.parse(fs.readFileSync(path.join(root, ANALYTICS_REL_PATH), "utf8")) as {
		version: string;
	};
	expect(analytics.version).toBe("0.20.12");
}

function expectOnlyVersionLineChanged(before: string, after: string, versionLine: string): void {
	const beforeLines = before.split("\n");
	const afterLines = after.split("\n");
	expect(afterLines.length).toBe(beforeLines.length);
	const changed: string[] = [];
	for (let index = 0; index < beforeLines.length; index++) {
		if (beforeLines[index] !== afterLines[index]) changed.push(afterLines[index] ?? "");
	}
	expect(changed).toEqual([versionLine]);
}

function withTemp(fn: (root: string) => void): void {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-release-bump-"));
	try {
		fn(root);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

test(
	"fixture AC1-rc: 0.25.3 -> 0.25.4-rc.1 writes every lockstep package and OpenAPI field",
	() => {
		withTemp(root => {
			seed(root, "0.25.3");
			const before = snapshot(root);
			const result = runBump(root, ["0.25.4-rc.1"]);
			expectSuccess(result);
			expect(result.stdout).toContain("Next release tag: v0.25.4-rc.1");
			expect(result.stderr).not.toContain("Version mismatch");

			expect(PACKAGE_REL_PATHS).toHaveLength(12);
			for (const relPath of PACKAGE_REL_PATHS) {
				const parsed = JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8")) as { version: string };
				expect(parsed.version, relPath).toBe("0.25.4-rc.1");
				expectOnlyVersionLineChanged(
					before.get(relPath)!,
					fs.readFileSync(path.join(root, relPath), "utf8"),
					packageVersionLine("0.25.4-rc.1"),
				);
			}

			const tsOpenApiPath = "sdks/envsync-ts-sdk/openapi.json";
			const tsOpenApi = JSON.parse(fs.readFileSync(path.join(root, tsOpenApiPath), "utf8")) as {
				info: { version: string };
			};
			expect(tsOpenApi.info.version).toBe("0.25.4-rc.1");
			expectOnlyVersionLineChanged(
				before.get(tsOpenApiPath)!,
				fs.readFileSync(path.join(root, tsOpenApiPath), "utf8"),
				openApiVersionLine("0.25.4-rc.1"),
			);

			const goOpenApiPath = "sdks/envsync-go-sdk/openapi.json";
			const goOpenApi = JSON.parse(fs.readFileSync(path.join(root, goOpenApiPath), "utf8")) as {
				info: { version: string };
			};
			expect(goOpenApi.info.version).toBe("0.25.4-rc.1");
			expectOnlyVersionLineChanged(
				before.get(goOpenApiPath)!,
				fs.readFileSync(path.join(root, goOpenApiPath), "utf8"),
				openApiVersionLine("0.25.4-rc.1"),
			);

			expectTrain(root, "0.25.4-rc.1");
			expect(fs.readFileSync(path.join(root, ANALYTICS_REL_PATH), "utf8")).toBe(before.get(ANALYTICS_REL_PATH));
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-mismatch: mismatched train exits non-zero without --force-sync",
	() => {
		withTemp(root => {
			seed(root, "0.25.3", { "packages/envsync-api/package.json": "0.25.2" });
			const before = snapshot(root);
			const result = runBump(root, ["0.25.4-rc.1"]);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain("Version mismatch");
			for (const relPath of LOCKSTEP_REL_PATHS) {
				const version = relPath === "packages/envsync-api/package.json" ? "0.25.2" : "0.25.3";
				expect(result.stderr).toContain(`${relPath}=${version}`);
			}
			expectUnchanged(root, before);
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-openapi-mismatch: OpenAPI info.version mismatch exits non-zero without --force-sync",
	() => {
		withTemp(root => {
			seed(root, "0.25.3", { "sdks/envsync-ts-sdk/openapi.json": "0.25.2" });
			const before = snapshot(root);
			const result = runBump(root, ["0.25.4-rc.1"]);
			expect(result.exitCode).not.toBe(0);
			expect(result.stderr).toContain("Version mismatch");
			expect(result.stderr).toContain("sdks/envsync-ts-sdk/openapi.json=0.25.2");
			expect(result.stderr).toContain("sdks/envsync-go-sdk/openapi.json=0.25.3");
			expect(result.stderr).toContain("package.json=0.25.3");
			expectUnchanged(root, before);
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-force-sync: --force-sync aligns a mismatched train",
	() => {
		withTemp(root => {
			// Root stays 0.25.3. patch must bump from that base, not from 0.25.2 or 0.25.1.
			seed(root, "0.25.3", {
				"packages/deploy/package.json": "0.25.2",
				"sdks/envsync-ts-sdk/openapi.json": "0.25.1",
			});
			const result = runBump(root, ["patch", "--force-sync"]);
			expectSuccess(result);
			expect(result.stdout).toContain("Next release tag: v0.25.4");
			expect(result.stderr).not.toContain("Version mismatch");
			expectTrain(root, "0.25.4");
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-patch: patch/minor/major and x.y.z still work",
	() => {
		withTemp(root => {
			const cases = [
				{ args: ["patch"], expected: "0.25.4" },
				{ args: ["minor"], expected: "0.26.0" },
				{ args: ["major"], expected: "1.0.0" },
				{ args: ["0.25.9"], expected: "0.25.9" },
			];
			for (const entry of cases) {
				seed(root, "0.25.3");
				const result = runBump(root, entry.args);
				expectSuccess(result);
				expect(result.stdout).toContain(`Next release tag: v${entry.expected}`);
				expectTrain(root, entry.expected);
			}
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-rc-base: patch from 0.25.4-rc.2 -> 0.25.5",
	() => {
		withTemp(root => {
			// Prerelease is stripped, then the core is bumped. rc numbers do not auto-increment.
			const bumps = [
				{ args: ["patch"], expected: "0.25.5" },
				{ args: ["minor"], expected: "0.26.0" },
				{ args: ["major"], expected: "1.0.0" },
			];
			for (const entry of bumps) {
				seed(root, "0.25.4-rc.2");
				const result = runBump(root, entry.args);
				expectSuccess(result);
				expect(result.stdout).toContain(`Next release tag: v${entry.expected}`);
				expectTrain(root, entry.expected);
			}

			seed(root, "0.25.4-rc.1");
			const explicit = runBump(root, ["0.25.4-rc.2"]);
			expectSuccess(explicit);
			expect(explicit.stdout).toContain("Next release tag: v0.25.4-rc.2");
			expectTrain(root, "0.25.4-rc.2");
		});
	},
	{ timeout: 30_000 },
);

test(
	"fixture AC1-invalid: rejects invalid versions",
	() => {
		withTemp(root => {
			seed(root, "0.25.3");
			const before = snapshot(root);
			const invalid = ["v0.25.4", "0.25.4-beta.1", "0.25.4-rc.0", "0.25.4-rc.01", "1.2"];
			for (const versionArg of invalid) {
				const result = runBump(root, [versionArg]);
				expect(result.exitCode, result.stderr).not.toBe(0);
				expect(result.stderr).toContain("Invalid version");
				expect(result.stderr).toContain(versionArg);
				expectUnchanged(root, before);
			}
		});
	},
	{ timeout: 30_000 },
);

test("fixture AC1-real-tree-paths: lockstep list matches the real repo", () => {
	expect(PACKAGE_REL_PATHS).toHaveLength(12);
	expect(OPENAPI_REL_PATHS).toHaveLength(2);
	expect(PACKAGE_REL_PATHS).not.toContain(ANALYTICS_REL_PATH);

	const versions = LOCKSTEP_REL_PATHS.map(relPath => {
		const absPath = path.join(REAL_ROOT, relPath);
		if (!fs.existsSync(absPath)) {
			throw new Error(`missing lockstep file ${relPath}`);
		}
		const parsed = JSON.parse(fs.readFileSync(absPath, "utf8")) as {
			version?: unknown;
			info?: { version?: unknown };
		};
		const version = relPath.endsWith("openapi.json") ? parsed.info?.version : parsed.version;
		if (typeof version !== "string") {
			throw new Error(`missing version in ${relPath}`);
		}
		return version;
	});

	expect(versions).toEqual(versions.map(() => versions[0]));
});
