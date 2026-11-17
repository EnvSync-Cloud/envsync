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
	return archivePath.replace(/\.tar\.gz(?:\.age)?$/, "") + ".identity";
}

export async function encryptBackup(plaintext: Uint8Array) {
	const identity = await generateIdentity();
	const recipient = await identityToRecipient(identity);
	const encrypter = new Encrypter();
	encrypter.addRecipient(recipient);
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

/** Encrypt a plaintext archive. The identity file is not stored inside the ciphertext. */
export async function sealPlaintextArchiveFile(tarPath: string) {
	const plaintext = fs.readFileSync(tarPath);
	if (isAgeCiphertext(plaintext)) {
		return { archivePath: tarPath, identityPath: identityPathForArchive(tarPath), recipient: "" };
	}
	const sealed = await encryptBackup(plaintext);
	const archivePath = `${tarPath}.age`;
	const identityPath = identityPathForArchive(archivePath);
	const identityText = sealed.identity.endsWith("\n") ? sealed.identity : `${sealed.identity}\n`;
	writePrivateFile(archivePath, sealed.ciphertext);
	writePrivateFile(identityPath, identityText);
	fs.rmSync(tarPath);
	return { archivePath, identityPath, recipient: sealed.recipient };
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

export async function sealPlaintextBackupArchives(directory: string) {
	const sealed = [];
	for (const archive of listPlaintextBackupArchives(directory)) {
		sealed.push(await sealPlaintextArchiveFile(archive));
	}
	return sealed;
}
