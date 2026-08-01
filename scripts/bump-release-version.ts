import fs from "node:fs";
import path from "node:path";

type BumpKind = "patch" | "minor" | "major";

interface PackageJsonShape {
	version: string;
}

const PACKAGE_FILES = [
	path.join(import.meta.dir, "..", "package.json"),
	path.join(import.meta.dir, "..", "packages", "deploy", "package.json"),
	path.join(import.meta.dir, "..", "packages", "deploy-cli", "package.json"),
	path.join(import.meta.dir, "..", "packages", "deploy-core", "package.json"),
	path.join(import.meta.dir, "..", "sdks", "envsync-ts-sdk", "package.json"),
	path.join(import.meta.dir, "..", "apps", "envsync-landing", "package.json"),
	path.join(import.meta.dir, "..", "apps", "envsync-web", "package.json"),
	path.join(import.meta.dir, "..", "packages", "envsync-api", "package.json"),
] as const;
const VALID_BUMP_KINDS = new Set<BumpKind>(["patch", "minor", "major"]);
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

function readPackageJson(filePath: string): PackageJsonShape {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as PackageJsonShape;
}

function writePackageVersion(filePath: string, nextVersion: string) {
	const packageJson = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
	packageJson.version = nextVersion;
	fs.writeFileSync(filePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

function bumpVersion(version: string, kind: BumpKind): string {
	const [major, minor, patch] = version.split(".").map(Number);
	switch (kind) {
		case "major":
			return `${major! + 1}.0.0`;
		case "minor":
			return `${major}.${minor! + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch! + 1}`;
	}
}

function usage() {
	console.error("Usage: bun run release:bump patch|minor|major|x.y.z [--force-sync]");
	process.exit(1);
}

const args = process.argv.slice(2);
const forceSync = args.includes("--force-sync");
const versionArg = args.find(arg => arg !== "--force-sync");

if (!versionArg) usage();

const packageVersions = PACKAGE_FILES.map(filePath => ({
	filePath,
	version: readPackageJson(filePath).version,
}));
const distinctVersions = [...new Set(packageVersions.map(entry => entry.version))];

if (distinctVersions.length > 1 && !forceSync) {
	const versionSummary = packageVersions
		.map(entry => `${path.relative(path.join(import.meta.dir, ".."), entry.filePath)}=${entry.version}`)
		.join(", ");
	console.error(`Version mismatch detected: ${versionSummary}. Re-run with --force-sync to align all files.`);
	process.exit(1);
}

const baseVersion = packageVersions[0]!.version;
const nextVersion = VALID_BUMP_KINDS.has(versionArg as BumpKind)
	? bumpVersion(baseVersion, versionArg as BumpKind)
	: versionArg;

if (!SEMVER_PATTERN.test(nextVersion!)) {
	console.error(`Invalid version: ${nextVersion}. Expected patch|minor|major or x.y.z.`);
	process.exit(1);
}

for (const filePath of PACKAGE_FILES) {
	writePackageVersion(filePath, nextVersion!);
}

console.log(`Updated release versions to ${nextVersion}`);
console.log(`Next release tag: v${nextVersion}`);
