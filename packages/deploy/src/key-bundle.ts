import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ensurePrivateDir, sealPlaintextFile } from "./backup-archive";
import {
	PROTECTED_ENV_KEYS,
	PROTECTED_MATERIAL,
	PROTECTED_MATERIAL_ARCHIVE_DIR,
	PROTECTED_SECRET_DIR_MODE,
	PROTECTED_SECRET_FILE_MODE,
} from "./protected-secrets";

export const KEY_BUNDLE_KIND = "envsync-key-bundle";
export const KEY_BUNDLE_VERSION = 1;
export const KEY_BUNDLE_DIR = "keys";
export const DATA_BACKUP_KEYS_NOTE =
	"Key material was excluded from this data backup. Restore it with an export-keys bundle: envsync-deploy restore <archive> --keys <bundle.age> --keys-identity <identity>.";

const CONFIG_KEY_FIELDS = new Set(["minikms_root_key", "minikms_session_signing_key"]);

export function privateKeyMaterials() {
	return PROTECTED_MATERIAL.filter(item => item.location === "secret");
}

export function requiredKeyFileNames() {
	return privateKeyMaterials().map(item => item.fileName);
}

export function stripProtectedEnvLines(content: string) {
	const keys = new Set<string>(PROTECTED_ENV_KEYS);
	const ended = content.endsWith("\n");
	const kept = content.split(/\r?\n/).filter(line => {
		const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
		return !match || !keys.has(match[1]);
	});
	const body = kept.join("\n").replace(/\n+$/, "");
	return ended || content.length === 0 ? `${body}\n` : body;
}

export function redactTextSecrets(content: string, secrets: readonly string[]) {
	let next = content;
	const values = [...secrets].filter(secret => secret.length >= 8).sort((a, b) => b.length - a.length);
	for (const secret of values) {
		if (next.includes(secret)) next = next.split(secret).join("");
	}
	return next;
}

function blankKeyFields(value: unknown) {
	if (!value || typeof value !== "object") return;
	if (Array.isArray(value)) {
		for (const item of value) blankKeyFields(item);
		return;
	}
	const record = value as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (CONFIG_KEY_FIELDS.has(key)) {
			record[key] = "";
			continue;
		}
		blankKeyFields(record[key]);
	}
}

export function redactConfigDocument(content: string, secrets: readonly string[]) {
	const stripped = redactTextSecrets(stripProtectedEnvLines(content), secrets);
	try {
		const parsed = JSON.parse(stripped);
		blankKeyFields(parsed);
		return `${JSON.stringify(parsed, null, 2)}\n`;
	} catch {
		return stripped;
	}
}

export interface BackupStageInputFile {
	relativePath: string;
	content: string;
	mode?: number;
}

export interface BackupStageProtectedFile {
	fileName: string;
	content: string;
	mode: number;
	privateKey: boolean;
}

export interface DataBackupStage {
	files: Array<{ relativePath: string; content: string; mode: number }>;
	keys: { included: boolean; excluded: string[]; note: string };
}

export function stageDataBackup(input: {
	files: BackupStageInputFile[];
	protectedFiles: BackupStageProtectedFile[];
	includeKeys: boolean;
	secretValues: readonly string[];
}): DataBackupStage {
	const excluded: string[] = [];
	const files = input.files.map(file => {
		const mode = file.mode ?? PROTECTED_SECRET_FILE_MODE;
		if (input.includeKeys) return { relativePath: file.relativePath, content: file.content, mode };
		const content = file.relativePath.endsWith(".json")
			? redactConfigDocument(file.content, input.secretValues)
			: stripProtectedEnvLines(redactTextSecrets(file.content, input.secretValues));
		return { relativePath: file.relativePath, content, mode };
	});
	for (const item of input.protectedFiles) {
		if (item.privateKey && !input.includeKeys) {
			excluded.push(item.fileName);
			continue;
		}
		const content = input.includeKeys ? item.content : redactTextSecrets(item.content, input.secretValues);
		files.push({
			relativePath: `${PROTECTED_MATERIAL_ARCHIVE_DIR}/${item.fileName}`,
			content,
			mode: item.mode,
		});
	}
	files.push({
		relativePath: "backup-manifest.json",
		content: `${JSON.stringify({
			keys_included: input.includeKeys,
			keys_excluded: input.includeKeys ? [] : excluded,
			keys_note: input.includeKeys
				? "Key material was included in this age-encrypted data backup."
				: DATA_BACKUP_KEYS_NOTE,
		}, null, 2)}\n`,
		mode: PROTECTED_SECRET_FILE_MODE,
	});
	return {
		files,
		keys: {
			included: input.includeKeys,
			excluded: input.includeKeys ? [] : excluded,
			note: input.includeKeys
				? "Key material was included in this age-encrypted data backup."
				: DATA_BACKUP_KEYS_NOTE,
		},
	};
}

export function writePrivateTree(root: string, files: Array<{ relativePath: string; content: string; mode: number }>) {
	ensurePrivateDir(root);
	for (const file of files) {
		const target = path.join(root, file.relativePath);
		ensurePrivateDir(path.dirname(target));
		fs.writeFileSync(target, file.content, { mode: file.mode });
		fs.chmodSync(target, file.mode);
	}
}

export function createTarGz(sourceDir: string, tarPath: string) {
	const result = spawnSync("tar", ["-czf", tarPath, "-C", sourceDir, "."], { stdio: "pipe" });
	if (result.status !== 0) {
		throw new Error(`tar failed: ${result.stderr?.toString() || "unknown error"}`);
	}
	fs.chmodSync(tarPath, PROTECTED_SECRET_FILE_MODE);
}

export interface KeyBundleFile {
	fileName: string;
	content: string;
}

export function buildKeyBundleFiles(entries: KeyBundleFile[], createdAt: string) {
	return [
		{
			relativePath: "manifest.json",
			content: `${JSON.stringify({
				kind: KEY_BUNDLE_KIND,
				version: KEY_BUNDLE_VERSION,
				created_at: createdAt,
				files: entries.map(entry => entry.fileName),
			}, null, 2)}\n`,
			mode: PROTECTED_SECRET_FILE_MODE,
		},
		...entries.map(entry => ({
			relativePath: path.posix.join(KEY_BUNDLE_DIR, entry.fileName),
			content: entry.content.endsWith("\n") ? entry.content : `${entry.content}\n`,
			mode: PROTECTED_SECRET_FILE_MODE,
		})),
	];
}

/** Reject an explicit export-keys identity that is the same file as the bundle output. */
export function assertDistinctExportKeysPaths(outputPath: string, identityPath: string | undefined) {
	if (identityPath === undefined) return;
	const output = path.resolve(outputPath);
	const identity = path.resolve(identityPath);
	if (output === identity) {
		throw new Error(
			`--identity and --output resolve to the same path (${output}). Pass a different --identity file.`,
		);
	}
}

export async function sealKeyBundle(opts: {
	entries: KeyBundleFile[];
	outputPath: string;
	stagingDir: string;
	recipients?: readonly string[];
	createdAt?: string;
}) {
	const payload = path.join(opts.stagingDir, "payload");
	const tarPath = path.join(opts.stagingDir, "bundle.tar.gz");
	try {
		writePrivateTree(payload, buildKeyBundleFiles(opts.entries, opts.createdAt ?? new Date().toISOString()));
		createTarGz(payload, tarPath);
		fs.rmSync(payload, { recursive: true, force: true });
		return await sealPlaintextFile(tarPath, opts.outputPath, opts.recipients ?? []);
	} finally {
		fs.rmSync(opts.stagingDir, { recursive: true, force: true });
	}
}

export function resolveRestoreKeys(check: {
	archiveKeyFiles: readonly string[];
	bundleKeyFiles?: readonly string[];
	keysIncludedInArchive: boolean;
}) {
	const required = requiredKeyFileNames();
	const archiveSet = new Set(check.archiveKeyFiles);
	const bundleSet = new Set(check.bundleKeyFiles ?? []);
	const archiveOk = check.keysIncludedInArchive && required.every(name => archiveSet.has(name));
	const bundleProvided = check.bundleKeyFiles !== undefined;
	const bundleOk = bundleProvided && required.every(name => bundleSet.has(name));
	if (archiveOk) return { source: "archive" as const };
	if (bundleOk) return { source: "bundle" as const };
	const missing = required.filter(name => !archiveSet.has(name) && !bundleSet.has(name));
	const hint = bundleProvided
		? "Provide a complete export-keys bundle with --keys and --keys-identity."
		: "The data backup does not include keys. Pass --keys <bundle.age> and --keys-identity <file> from envsync-deploy export-keys.";
	throw new Error(`Restore is missing key material (${missing.join(", ")}). ${hint}`);
}

export function restoreKeyFiles(opts: { files: KeyBundleFile[]; secretDir: string }) {
	fs.mkdirSync(opts.secretDir, { recursive: true, mode: PROTECTED_SECRET_DIR_MODE });
	fs.chmodSync(opts.secretDir, PROTECTED_SECRET_DIR_MODE);
	const written: string[] = [];
	for (const file of opts.files) {
		const target = path.join(opts.secretDir, file.fileName);
		fs.writeFileSync(target, file.content, { mode: PROTECTED_SECRET_FILE_MODE });
		fs.chmodSync(target, PROTECTED_SECRET_FILE_MODE);
		written.push(target);
	}
	return written;
}

export function readKeyBundleEntries(bundleRoot: string): KeyBundleFile[] {
	const dir = path.join(bundleRoot, KEY_BUNDLE_DIR);
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir).filter(name => fs.statSync(path.join(dir, name)).isFile()).map(fileName => ({
		fileName,
		content: fs.readFileSync(path.join(dir, fileName), "utf8"),
	}));
}

