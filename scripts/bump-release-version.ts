import fs from "node:fs";
import path from "node:path";

type BumpKind = "patch" | "minor" | "major";
type LockstepKind = "package" | "openapi";

interface LockstepFile {
	relPath: string;
	kind: LockstepKind;
	version: string;
	raw: string;
}

interface VersionSpan {
	start: number;
	end: number;
}

/**
 * Product release train — keep in lockstep for `vX.Y.Z` and `vX.Y.Z-rc.N` tags.
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

/** OpenAPI documents whose info.version stays on the same release train. */
const OPENAPI_REL_PATHS = [
	"sdks/envsync-ts-sdk/openapi.json",
	"sdks/envsync-go-sdk/openapi.json",
] as const;

const RELEASE_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-rc\.([1-9]\d*))?$/;

function fail(message: string): never {
	console.error(message);
	process.exit(1);
}

function usage(): never {
	console.error("Usage: bun run release:bump patch|minor|major|x.y.z|x.y.z-rc.N [--force-sync]");
	console.error("");
	console.error("patch, minor, and major bump the core version. A prerelease suffix on the");
	console.error("current version is stripped first (0.25.4-rc.2 + patch -> 0.25.5,");
	console.error("minor -> 0.26.0, major -> 1.0.0).");
	console.error("Pass x.y.z-rc.N to set that prerelease explicitly. N is a positive integer");
	console.error("with no leading zeros (0.25.4-rc.2 is valid, 0.25.4-rc.0 and 0.25.4-rc.01 are not).");
	console.error("");
	console.error("Lockstep package.json files and OpenAPI info.version fields must already match,");
	console.error("unless --force-sync is set. With --force-sync the base version is the root");
	console.error("package.json version. packages/envsync-analytics is intentionally not on the train.");
	process.exit(1);
}

function isBumpKind(value: string): value is BumpKind {
	return value === "patch" || value === "minor" || value === "major";
}

function rejectVersion(versionArg: string): never {
	fail(
		`Invalid version: ${versionArg}. Expected patch, minor, major, x.y.z, or x.y.z-rc.N (N is a positive integer with no leading zeros).`,
	);
}

/**
 * patch, minor, and major ignore a trailing -rc.N and bump the core.
 * 0.25.4-rc.2 + patch -> 0.25.5, + minor -> 0.26.0, + major -> 1.0.0.
 * The rc counter advances only when the next x.y.z-rc.N is passed explicitly.
 */
function bumpCore(version: string, kind: BumpKind): string {
	const match = RELEASE_VERSION_PATTERN.exec(version);
	if (!match) {
		fail(
			`Cannot bump current version ${version}. Expected x.y.z or x.y.z-rc.N (N is a positive integer with no leading zeros).`,
		);
	}
	const major = Number(match[1]);
	const minor = Number(match[2]);
	const patch = Number(match[3]);
	switch (kind) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
	}
}

function readVersion(data: unknown, kind: LockstepKind): string | null {
	if (!data || typeof data !== "object") return null;
	if (kind === "package") {
		const version = (data as { version?: unknown }).version;
		return typeof version === "string" ? version : null;
	}
	const info = (data as { info?: unknown }).info;
	if (!info || typeof info !== "object") return null;
	const version = (info as { version?: unknown }).version;
	return typeof version === "string" ? version : null;
}

function readLockstepFile(repoRoot: string, relPath: string, kind: LockstepKind): LockstepFile {
	const absPath = path.join(repoRoot, relPath);
	let raw: string;
	try {
		raw = fs.readFileSync(absPath, "utf8");
	} catch (error) {
		fail(`Failed to read ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (error) {
		fail(`Failed to parse ${relPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
	const version = readVersion(data, kind);
	if (version === null) {
		const field = kind === "package" ? "version" : "info.version";
		fail(`Missing string ${field} in ${relPath}`);
	}
	return { relPath, kind, version, raw };
}

/**
 * Swap only the lockstep version string inside the existing JSON text.
 * OpenAPI documents are large; JSON.stringify would rewrite unrelated lines.
 */
function findVersionValueSpan(raw: string, kind: LockstepKind): VersionSpan {
	let i = 0;

	function skipWs(): void {
		while (i < raw.length) {
			const ch = raw[i];
			if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
				i++;
				continue;
			}
			break;
		}
	}

	function readString(): { start: number; end: number; decoded: string } {
		if (raw[i] !== '"') throw new Error(`Expected a string at index ${i}`);
		i++;
		const start = i;
		let decoded = "";
		while (i < raw.length) {
			const ch = raw[i]!;
			if (ch === '"') {
				const end = i;
				i++;
				return { start, end, decoded };
			}
			if (ch === "\\") {
				const esc = raw[i + 1];
				if (esc === undefined) throw new Error("Truncated string escape");
				if (esc === "u") {
					const hex = raw.slice(i + 2, i + 6);
					if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error("Bad unicode escape");
					decoded += String.fromCharCode(Number.parseInt(hex, 16));
					i += 6;
					continue;
				}
				const simple: Record<string, string> = {
					'"': '"',
					"\\": "\\",
					"/": "/",
					b: "\b",
					f: "\f",
					n: "\n",
					r: "\r",
					t: "\t",
				};
				if (!(esc in simple)) throw new Error(`Bad escape \\${esc}`);
				decoded += simple[esc]!;
				i += 2;
				continue;
			}
			decoded += ch;
			i++;
		}
		throw new Error("Unterminated string");
	}

	function skipLiteral(): void {
		const start = i;
		if (raw.startsWith("true", i)) {
			i += 4;
			return;
		}
		if (raw.startsWith("false", i)) {
			i += 5;
			return;
		}
		if (raw.startsWith("null", i)) {
			i += 4;
			return;
		}
		if (raw[i] === "-") i++;
		const consumeDigits = (): boolean => {
			const digitStart = i;
			while (i < raw.length && raw[i]! >= "0" && raw[i]! <= "9") i++;
			return i > digitStart;
		};
		if (!consumeDigits()) throw new Error(`Unexpected token at index ${start}`);
		if (raw[i] === ".") {
			i++;
			if (!consumeDigits()) throw new Error(`Invalid number at index ${start}`);
		}
		if (raw[i] === "e" || raw[i] === "E") {
			i++;
			if (raw[i] === "+" || raw[i] === "-") i++;
			if (!consumeDigits()) throw new Error(`Invalid number at index ${start}`);
		}
	}

	function skipValue(): void {
		skipWs();
		const ch = raw[i];
		if (ch === '"') {
			readString();
			return;
		}
		if (ch === "{") {
			walkObject(false, false);
			return;
		}
		if (ch === "[") {
			walkArray();
			return;
		}
		skipLiteral();
	}

	function walkArray(): void {
		if (raw[i] !== "[") throw new Error(`Expected an array at index ${i}`);
		i++;
		skipWs();
		if (raw[i] === "]") {
			i++;
			return;
		}
		while (i < raw.length) {
			skipValue();
			skipWs();
			if (raw[i] === ",") {
				i++;
				continue;
			}
			if (raw[i] === "]") {
				i++;
				return;
			}
			throw new Error(`Expected comma or end of array at index ${i}`);
		}
		throw new Error("Unterminated array");
	}

	function walkObject(captureDirectVersion: boolean, atRoot: boolean): VersionSpan | null {
		if (raw[i] !== "{") throw new Error(`Expected an object at index ${i}`);
		i++;
		skipWs();
		if (raw[i] === "}") {
			i++;
			return null;
		}
		while (i < raw.length) {
			skipWs();
			const key = readString();
			skipWs();
			if (raw[i] !== ":") throw new Error(`Expected a colon at index ${i}`);
			i++;
			skipWs();

			if (captureDirectVersion && key.decoded === "version") {
				if (raw[i] !== '"') throw new Error("version is not a string");
				const value = readString();
				return { start: value.start, end: value.end };
			}

			if (atRoot && kind === "openapi" && key.decoded === "info") {
				if (raw[i] !== "{") throw new Error("info is not an object");
				const span = walkObject(true, false);
				if (!span) throw new Error("Missing info.version");
				return span;
			}

			skipValue();
			skipWs();
			if (raw[i] === ",") {
				i++;
				continue;
			}
			if (raw[i] === "}") {
				i++;
				return null;
			}
			throw new Error(`Expected comma or end of object at index ${i}`);
		}
		throw new Error("Unterminated object");
	}

	skipWs();
	const span = kind === "package" ? walkObject(true, true) : walkObject(false, true);
	if (!span) {
		throw new Error(kind === "package" ? "Missing version" : "Missing info.version");
	}
	return span;
}

function replaceVersion(raw: string, kind: LockstepKind, nextVersion: string): string {
	const span = findVersionValueSpan(raw, kind);
	return raw.slice(0, span.start) + nextVersion + raw.slice(span.end);
}

/** Repo root. Tests override this with RELEASE_BUMP_ROOT. */
const repoRoot = process.env.RELEASE_BUMP_ROOT
	? path.resolve(process.env.RELEASE_BUMP_ROOT)
	: path.resolve(import.meta.dir, "..");

const args = process.argv.slice(2);
const forceSync = args.includes("--force-sync");
const versionArg = args.find(arg => arg !== "--force-sync");
if (!versionArg) usage();

if (!isBumpKind(versionArg) && !RELEASE_VERSION_PATTERN.test(versionArg)) {
	console.error(
		"patch, minor, and major strip any -rc.N suffix and bump the core (0.25.4-rc.2 + patch -> 0.25.5).",
	);
	rejectVersion(versionArg);
}

const files: LockstepFile[] = [
	...PACKAGE_REL_PATHS.map(relPath => readLockstepFile(repoRoot, relPath, "package")),
	...OPENAPI_REL_PATHS.map(relPath => readLockstepFile(repoRoot, relPath, "openapi")),
];

const distinctVersions = new Set(files.map(file => file.version));
if (distinctVersions.size > 1 && !forceSync) {
	const summary = files.map(file => `${file.relPath}=${file.version}`).join(", ");
	fail(`Version mismatch detected: ${summary}. Re-run with --force-sync to align all files.`);
}

const rootPackage = files.find(file => file.kind === "package" && file.relPath === "package.json");
if (!rootPackage) fail("Root package.json is missing from the release train.");

const nextVersion = isBumpKind(versionArg) ? bumpCore(rootPackage.version, versionArg) : versionArg;
if (!RELEASE_VERSION_PATTERN.test(nextVersion)) {
	fail(`Refusing to write invalid version ${nextVersion}.`);
}

const updates = files.map(file => {
	let contents: string;
	try {
		contents = replaceVersion(file.raw, file.kind, nextVersion);
		const parsed = JSON.parse(contents) as unknown;
		if (readVersion(parsed, file.kind) !== nextVersion) {
			throw new Error("version edit did not change the lockstep field");
		}
	} catch (error) {
		fail(`Failed to update ${file.relPath}: ${error instanceof Error ? error.message : String(error)}`);
	}
	return { absPath: path.join(repoRoot, file.relPath), contents };
});

for (const update of updates) {
	fs.writeFileSync(update.absPath, update.contents);
}

console.log(`Updated release versions to ${nextVersion}`);
console.log(`Next release tag: v${nextVersion}`);
