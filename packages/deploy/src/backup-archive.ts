import fs from "node:fs";
import path from "node:path";

import { Decrypter, Encrypter, generateIdentity, identityToRecipient } from "age-encryption";

export const AGE_FILE_PREFIX = "age-encryption.org/v1";
const IDENTITY_FILE_MODE = 0o600;

export type BackupOutputMode = "age" | "plaintext";

export function assertBackupMode(encrypted: boolean, insecureUnencrypted: boolean): BackupOutputMode {
	if (encrypted && insecureUnencrypted) {
		throw new Error("backup.encrypted is true. Remove --insecure-unencrypted.");
	}
	if (!encrypted && !insecureUnencrypted) {
		throw new Error(
			"Refusing an unencrypted backup. Set backup.encrypted: true, or pass --insecure-unencrypted.",
		);
	}
	return encrypted ? "age" : "plaintext";
}

export function isAgeCiphertext(bytes: Uint8Array) {
	const prefix = new TextDecoder().decode(bytes.subarray(0, AGE_FILE_PREFIX.length));
	return prefix === AGE_FILE_PREFIX;
}

export function identityPathForArchive(archivePath: string) {
	const stripped = archivePath.replace(/\.age$/, "").replace(/\.tar\.gz$/, "").replace(/\.dump$/, "");
	return `${stripped}.identity`;
}

export function assertIncludeKeysAllowed(includeKeys: boolean, mode: BackupOutputMode) {
	if (includeKeys && mode !== "age") {
		throw new Error("--include-keys requires an age-encrypted backup. Remove --insecure-unencrypted.");
	}
}

export async function encryptBackup(plaintext: Uint8Array, recipients: readonly string[] = []) {
	const identity = await generateIdentity();
	const recipient = await identityToRecipient(identity);
	const encrypter = new Encrypter();
	encrypter.addRecipient(recipient);
	for (const extra of recipients) {
		const trimmed = extra.trim();
		if (trimmed) encrypter.addRecipient(trimmed);
	}
	const ciphertext = await encrypter.encrypt(plaintext);
	return { ciphertext, identity, recipient };
}

export async function decryptBackup(ciphertext: Uint8Array, identity: string) {
	const decrypter = new Decrypter();
	decrypter.addIdentity(identity.trim());
	return decrypter.decrypt(ciphertext);
}

function writePrivateFile(target: string, bytes: Uint8Array | string) {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, bytes, { mode: IDENTITY_FILE_MODE });
	fs.chmodSync(target, IDENTITY_FILE_MODE);
}

/** Encrypt a plaintext file to `sealedPath`. The identity is not stored inside the ciphertext. */
export async function sealPlaintextFile(sourcePath: string, sealedPath: string, recipients: readonly string[] = []) {
	// Read timestamps before the plaintext read, which can refresh atime.
	const sourceStat = fs.statSync(sourcePath);
	const plaintext = fs.readFileSync(sourcePath);
	if (isAgeCiphertext(plaintext)) {
		return { archivePath: sourcePath, identityPath: identityPathForArchive(sourcePath), recipient: "" };
	}
	const sealed = await encryptBackup(plaintext, recipients);
	const identityPath = identityPathForArchive(sealedPath);
	const identityText = sealed.identity.endsWith("\n") ? sealed.identity : `${sealed.identity}\n`;
	writePrivateFile(sealedPath, sealed.ciphertext);
	writePrivateFile(identityPath, identityText);
	// Retention uses mtime. Copy the source times before the plaintext file is removed.
	fs.utimesSync(sealedPath, sourceStat.atime, sourceStat.mtime);
	fs.rmSync(sourcePath);
	return { archivePath: sealedPath, identityPath, recipient: sealed.recipient };
}

/** Encrypt a plaintext archive. The identity file is not stored inside the ciphertext. */
export async function sealPlaintextArchiveFile(tarPath: string, recipients: readonly string[] = []) {
	return sealPlaintextFile(tarPath, `${tarPath}.age`, recipients);
}

export function listPlaintextBackupArchives(directory: string) {
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory)
		.filter(name => name.startsWith("envsync-backup-") && name.endsWith(".tar.gz"))
		.map(name => path.join(directory, name))
		.filter(filePath => {
			const handle = fs.openSync(filePath, "r");
			try {
				const header = Buffer.alloc(AGE_FILE_PREFIX.length);
				fs.readSync(handle, header, 0, header.length, 0);
				return !isAgeCiphertext(header);
			} finally {
				fs.closeSync(handle);
			}
		});
}

export async function sealPlaintextBackupArchives(directory: string, recipients: readonly string[] = []) {
	const sealed = [];
	for (const archive of listPlaintextBackupArchives(directory)) {
		sealed.push(await sealPlaintextArchiveFile(archive, recipients));
	}
	return sealed;
}

export const PRIVATE_DIR_MODE = 0o700;
export const UPGRADE_SNAPSHOT_PREFIX = "envsync-db-preupgrade-";
export const DEFAULT_SNAPSHOT_RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function ensurePrivateDir(directory: string) {
	fs.mkdirSync(directory, { recursive: true, mode: PRIVATE_DIR_MODE });
	fs.chmodSync(directory, PRIVATE_DIR_MODE);
}

function readFileHeader(filePath: string) {
	const handle = fs.openSync(filePath, "r");
	try {
		const header = Buffer.alloc(AGE_FILE_PREFIX.length);
		fs.readSync(handle, header, 0, header.length, 0);
		return header;
	} finally {
		fs.closeSync(handle);
	}
}

export function listPlaintextUpgradeDumps(directory: string) {
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory)
		.filter(name => name.startsWith(UPGRADE_SNAPSHOT_PREFIX) && name.endsWith(".dump"))
		.map(name => path.join(directory, name))
		.filter(filePath => !isAgeCiphertext(readFileHeader(filePath)));
}

export async function sealPlaintextUpgradeDumps(directory: string, recipients: readonly string[] = []) {
	ensurePrivateDir(directory);
	const sealed = [];
	for (const dumpPath of listPlaintextUpgradeDumps(directory)) {
		sealed.push(await sealPlaintextFile(dumpPath, `${dumpPath}.age`, recipients));
	}
	return sealed;
}

export function upgradeSnapshotStem(fileName: string) {
	if (!fileName.startsWith(UPGRADE_SNAPSHOT_PREFIX)) return null;
	if (fileName.endsWith(".dump.age")) return fileName.slice(0, -".dump.age".length);
	if (fileName.endsWith(".dump")) return fileName.slice(0, -".dump".length);
	if (fileName.endsWith(".identity")) return fileName.slice(0, -".identity".length);
	return null;
}

export function selectExpiredUpgradeSnapshots(
	files: Array<{ name: string; mtimeMs: number }>,
	retentionDays: number,
	nowMs: number,
) {
	const cutoff = nowMs - retentionDays * DAY_MS;
	const groups = new Map<string, Array<{ name: string; mtimeMs: number }>>();
	for (const file of files) {
		const stem = upgradeSnapshotStem(file.name);
		if (!stem) continue;
		const list = groups.get(stem) ?? [];
		list.push(file);
		groups.set(stem, list);
	}
	const expired: string[] = [];
	for (const group of groups.values()) {
		const primaries = group.filter(file => file.name.endsWith(".dump") || file.name.endsWith(".dump.age"));
		const stamp = Math.max(...(primaries.length > 0 ? primaries : group).map(file => file.mtimeMs));
		if (stamp < cutoff) expired.push(...group.map(file => file.name));
	}
	return expired;
}

export function pruneUpgradeSnapshots(directory: string, retentionDays: number, nowMs = Date.now()) {
	if (!fs.existsSync(directory)) return { removed: [] as string[], kept: [] as string[] };
	const names = fs.readdirSync(directory);
	const files = names.map(name => ({
		name,
		mtimeMs: fs.statSync(path.join(directory, name)).mtimeMs,
	}));
	const expired = new Set(selectExpiredUpgradeSnapshots(files, retentionDays, nowMs));
	const removed: string[] = [];
	for (const name of expired) {
		const full = path.join(directory, name);
		fs.rmSync(full, { force: true });
		removed.push(full);
	}
	const kept = names
		.filter(name => upgradeSnapshotStem(name) && !expired.has(name))
		.map(name => path.join(directory, name));
	return { removed, kept };
}

export function removeSealedSnapshot(snapshotPath: string) {
	fs.rmSync(snapshotPath, { force: true });
	fs.rmSync(identityPathForArchive(snapshotPath), { force: true });
	if (snapshotPath.endsWith(".age")) fs.rmSync(snapshotPath.slice(0, -".age".length), { force: true });
}
