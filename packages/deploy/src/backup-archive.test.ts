import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import {
	assertBackupMode,
	decryptBackup,
	identityPathForArchive,
	isAgeCiphertext,
	pruneUpgradeSnapshots,
	sealPlaintextArchiveFile,
	sealPlaintextBackupArchives,
	sealPlaintextFile,
} from "./backup-archive";

const SECRET = "backup-plaintext-DEV137-value";

describe("backup encryption", () => {
	test("refuses an unencrypted archive unless the insecure flag is explicit", () => {
		expect(assertBackupMode(true, false)).toBe("age");
		expect(assertBackupMode(false, true)).toBe("plaintext");
		expect(() => assertBackupMode(false, false)).toThrow(/Refusing an unencrypted backup/);
		expect(() => assertBackupMode(true, true)).toThrow(/Remove --insecure-unencrypted/);
	});

	test("encrypts an archive and keeps the identity outside it", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-backup-"));
		try {
			const tarPath = path.join(dir, "envsync-backup-2024.tar.gz");
			fs.writeFileSync(tarPath, `not-a-real-tar ${SECRET}\n`);
			const sealed = await sealPlaintextArchiveFile(tarPath);
			const ciphertext = fs.readFileSync(sealed.archivePath);
			const identity = fs.readFileSync(sealed.identityPath, "utf8");

			expect(fs.existsSync(tarPath)).toBe(false);
			expect(sealed.archivePath.endsWith(".tar.gz.age")).toBe(true);
			expect(sealed.identityPath).toBe(identityPathForArchive(sealed.archivePath));
			expect(isAgeCiphertext(ciphertext)).toBe(true);
			expect(ciphertext.includes(Buffer.from(SECRET))).toBe(false);
			expect(ciphertext.includes(Buffer.from("AGE-SECRET-KEY-"))).toBe(false);
			expect(identity.startsWith("AGE-SECRET-KEY-")).toBe(true);
			expect((fs.statSync(sealed.identityPath).mode & 0o777) === 0o600).toBe(true);
			expect((fs.statSync(sealed.archivePath).mode & 0o777) === 0o600).toBe(true);

			const opened = await decryptBackup(ciphertext, identity);
			expect(Buffer.from(opened).toString("utf8")).toContain(SECRET);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("keeps the source atime and mtime on the sealed file so retention still sees its age", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-backup-mtime-"));
		try {
			const dump = path.join(dir, "envsync-db-preupgrade-1.0.0-to-1.1.0.dump");
			fs.writeFileSync(dump, "PGDMP-old-snapshot\n");
			const atime = new Date("2020-01-01T00:00:00.000Z");
			const mtime = new Date("2020-01-15T00:00:00.000Z");
			fs.utimesSync(dump, atime, mtime);
			const sealed = await sealPlaintextFile(dump, `${dump}.age`);
			const sealedStat = fs.statSync(sealed.archivePath);
			expect(Math.abs(sealedStat.atimeMs - atime.getTime())).toBeLessThan(1000);
			expect(Math.abs(sealedStat.mtimeMs - mtime.getTime())).toBeLessThan(1000);
			expect(fs.existsSync(dump)).toBe(false);

			const now = Date.parse("2020-01-23T00:00:00.000Z");
			const pruned = pruneUpgradeSnapshots(dir, 7, now);
			expect(pruned.removed.map(file => path.basename(file)).sort()).toEqual([
				"envsync-db-preupgrade-1.0.0-to-1.1.0.dump.age",
				"envsync-db-preupgrade-1.0.0-to-1.1.0.identity",
			]);
			expect(fs.existsSync(sealed.archivePath)).toBe(false);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("encrypts an existing plaintext archive and removes it", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-backup-old-"));
		try {
			const tarPath = path.join(dir, "envsync-backup-old.tar.gz");
			fs.writeFileSync(tarPath, SECRET);
			const sealed = await sealPlaintextBackupArchives(dir);
			expect(sealed).toHaveLength(1);
			expect(fs.existsSync(tarPath)).toBe(false);
			expect(fs.existsSync(sealed[0].archivePath)).toBe(true);
			expect(fs.readFileSync(sealed[0].archivePath).includes(Buffer.from(SECRET))).toBe(false);
			expect((await sealPlaintextBackupArchives(dir))).toHaveLength(0);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
