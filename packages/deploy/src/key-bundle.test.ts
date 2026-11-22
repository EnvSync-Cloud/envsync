import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import { describe, expect, it } from "bun:test";

import {
	decryptBackup,
	isAgeCiphertext,
	pruneUpgradeSnapshots,
	sealPlaintextArchiveFile,
	sealPlaintextUpgradeDumps,
	selectExpiredUpgradeSnapshots,
} from "./backup-archive";
import {
	assertDistinctExportKeysPaths,
	createTarGz,
	readKeyBundleEntries,
	requiredKeyFileNames,
	resolveRestoreKeys,
	restoreKeyFiles,
	sealKeyBundle,
	stageDataBackup,
	writePrivateTree,
} from "./key-bundle";
import { PROTECTED_MATERIAL } from "./protected-secrets";

function sentinels() {
	return {
		root: randomBytes(32).toString("hex"),
		session: `-----BEGIN PRIVATE KEY-----\n${randomBytes(48).toString("base64")}\n-----END PRIVATE KEY-----\n`,
		pem: randomBytes(32).toString("hex"),
	};
}

function assertAbsent(bytes: Uint8Array, values: string[]) {
	for (const value of values) {
		expect(Buffer.from(bytes).includes(Buffer.from(value))).toBe(false);
	}
}

describe("data backup key exclusion", () => {
	it("keeps root, session-signing, and PEM sentinels out of the staged archive and the age ciphertext", async () => {
		const keys = sentinels();
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-data-backup-"));
		try {
			const protectedFiles = PROTECTED_MATERIAL.map(item => ({
				fileName: item.fileName,
				mode: item.mode,
				privateKey: item.location === "secret",
				content: item.id === "minikms_root_key"
					? `${keys.root}\n`
					: item.id === "minikms_session_signing_key"
						? keys.session
						: item.location === "secret"
							? `${keys.pem}\n`
							: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n",
			}));
			const staged = stageDataBackup({
				includeKeys: false,
				secretValues: [keys.root, keys.session, keys.pem],
				files: [
					{ relativePath: "deploy.env", content: `MINIKMS_ROOT_KEY=${keys.root}\nMINIKMS_SESSION_SIGNING_KEY=${keys.session}\nS3_SECRET_KEY=keep-me\n` },
					{ relativePath: "config.json", content: JSON.stringify({ generated: { secrets: { minikms_root_key: keys.root, minikms_session_signing_key: keys.session, minikms_db_password: "db-pass" } } }) },
					{ relativePath: "docker-stack.yaml", content: `env:\n  MINIKMS_ROOT_KEY=${keys.root}\n  note: ${keys.pem}\n` },
				],
				protectedFiles,
			});
			const stagedBytes = Buffer.from(staged.files.map(file => file.content).join("\n"));
			assertAbsent(stagedBytes, [keys.root, keys.session, keys.pem]);
			expect(stagedBytes.toString("utf8")).toContain("keep-me");
			expect(staged.keys.included).toBe(false);
			expect(staged.keys.excluded).toContain("minikms-root-key");
			expect(staged.keys.note).toContain("export-keys");

			const tree = path.join(dir, "tree");
			const tarPath = path.join(dir, "envsync-backup-test.tar.gz");
			writePrivateTree(tree, staged.files);
			createTarGz(tree, tarPath);
			const sealed = await sealPlaintextArchiveFile(tarPath);
			const ciphertext = fs.readFileSync(sealed.archivePath);
			expect(isAgeCiphertext(ciphertext)).toBe(true);
			assertAbsent(ciphertext, [keys.root, keys.session, keys.pem]);
			const opened = zlib.gunzipSync(Buffer.from(await decryptBackup(ciphertext, fs.readFileSync(sealed.identityPath, "utf8"))));
			assertAbsent(opened, [keys.root, keys.session, keys.pem]);
			expect(opened.toString("utf8")).toContain("keep-me");
			expect(opened.toString("utf8")).toContain("db-pass");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("export-keys bundle", () => {
	it("writes a mode 0600 age bundle and a separate mode 0600 identity that round-trips the keys", async () => {
		const keys = sentinels();
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-export-keys-"));
		const outputPath = path.join(dir, "envsync-keys.tar.gz.age");
		const stagingDir = path.join(dir, "staging");
		try {
			const entries = requiredKeyFileNames().map(fileName => ({
				fileName,
				content: fileName === "minikms-root-key" ? keys.root : fileName.includes("session") ? keys.session : keys.pem,
			}));
			const sealed = await sealKeyBundle({ entries, outputPath, stagingDir, createdAt: "2026-01-01T00:00:00.000Z" });
			expect(fs.existsSync(stagingDir)).toBe(false);
			expect(sealed.archivePath).toBe(outputPath);
			expect((fs.statSync(sealed.archivePath).mode & 0o777)).toBe(0o600);
			expect((fs.statSync(sealed.identityPath).mode & 0o777)).toBe(0o600);
			expect(sealed.identityPath).not.toBe(sealed.archivePath);
			const ciphertext = fs.readFileSync(sealed.archivePath);
			expect(isAgeCiphertext(ciphertext)).toBe(true);
			assertAbsent(ciphertext, [keys.root, keys.session, keys.pem]);
			const opened = zlib.gunzipSync(Buffer.from(await decryptBackup(ciphertext, fs.readFileSync(sealed.identityPath, "utf8"))));
			expect(opened.toString("utf8")).toContain(keys.root);
			expect(opened.toString("utf8")).toContain(keys.session);
			expect(opened.toString("utf8")).toContain(keys.pem);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("rejects an explicit identity that resolves to the same path as the output", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-export-keys-paths-"));
		try {
			const output = path.join(dir, "envsync-keys.tar.gz.age");
			const sameViaParent = path.join(dir, "nested", "..", "envsync-keys.tar.gz.age");
			expect(() => assertDistinctExportKeysPaths(output, output)).toThrow(/same path/);
			expect(() => assertDistinctExportKeysPaths(output, sameViaParent)).toThrow(/same path/);
			expect(() => assertDistinctExportKeysPaths("envsync-keys.tar.gz.age", path.resolve("envsync-keys.tar.gz.age"))).toThrow(/same path/);
			expect(() => assertDistinctExportKeysPaths(output, path.join(dir, "envsync-keys.identity"))).not.toThrow();
			expect(() => assertDistinctExportKeysPaths(output, undefined)).not.toThrow();
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("restore key bundle", () => {
	it("refuses when keys are absent and recreates mode 0600 key files when a bundle is supplied", async () => {
		const keys = sentinels();
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-restore-keys-"));
		try {
			expect(() => resolveRestoreKeys({
				archiveKeyFiles: [],
				keysIncludedInArchive: false,
			})).toThrow(/missing key material/);
			const entries = requiredKeyFileNames().map(fileName => ({
				fileName,
				content: fileName === "minikms-root-key" ? keys.root : fileName.includes("session") ? keys.session : `${keys.pem}-${fileName}`,
			}));
			const outputPath = path.join(dir, "bundle.tar.gz.age");
			const sealed = await sealKeyBundle({ entries, outputPath, stagingDir: path.join(dir, "staging") });
			const extract = path.join(dir, "extract");
			fs.mkdirSync(extract, { recursive: true });
			const tarPath = path.join(dir, "bundle.tar.gz");
			fs.writeFileSync(tarPath, Buffer.from(await decryptBackup(fs.readFileSync(sealed.archivePath), fs.readFileSync(sealed.identityPath, "utf8"))), { mode: 0o600 });
			const extracted = spawnTar(tarPath, extract);
			expect(extracted).toBe(0);
			const bundleEntries = readKeyBundleEntries(extract);
			expect(resolveRestoreKeys({
				archiveKeyFiles: [],
				bundleKeyFiles: bundleEntries.map(entry => entry.fileName),
				keysIncludedInArchive: false,
			}).source).toBe("bundle");
			const secretDir = path.join(dir, "minikms");
			const written = restoreKeyFiles({ files: bundleEntries, secretDir });
			expect(written.length).toBe(requiredKeyFileNames().length);
			for (const target of written) {
				expect((fs.statSync(target).mode & 0o777)).toBe(0o600);
			}
			expect(fs.readFileSync(path.join(secretDir, "minikms-root-key"), "utf8")).toContain(keys.root);
			expect(fs.readFileSync(path.join(secretDir, "minikms-session-signing-key.pem"), "utf8")).toContain(keys.session.trim());
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

function spawnTar(tarPath: string, dest: string) {
	return spawnSync("tar", ["-xzf", tarPath, "-C", dest], { stdio: "pipe" }).status;
}

describe("upgrade snapshot sealing and retention", () => {
	it("seals a dump to mode 0600 age ciphertext and leaves no unencrypted dump", async () => {
		const secret = randomBytes(32).toString("hex");
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-upgrade-seal-"));
		try {
			const dump = path.join(dir, "envsync-db-preupgrade-1.0.0-to-1.1.0.dump");
			fs.writeFileSync(dump, `PGDMP${secret}\n`);
			const sealed = await sealPlaintextUpgradeDumps(dir);
			expect(sealed).toHaveLength(1);
			expect(fs.existsSync(dump)).toBe(false);
			expect((fs.statSync(dir).mode & 0o777)).toBe(0o700);
			expect((fs.statSync(sealed[0].archivePath).mode & 0o777)).toBe(0o600);
			const ciphertext = fs.readFileSync(sealed[0].archivePath);
			expect(isAgeCiphertext(ciphertext)).toBe(true);
			expect(ciphertext.includes(Buffer.from(secret))).toBe(false);
			const opened = Buffer.from(await decryptBackup(ciphertext, fs.readFileSync(sealed[0].identityPath, "utf8"))).toString("utf8");
			expect(opened).toContain(secret);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("prunes snapshots older than N days and keeps newer ones", () => {
		const now = Date.parse("2026-04-01T00:00:00.000Z");
		const day = 24 * 60 * 60 * 1000;
		const names = selectExpiredUpgradeSnapshots([
			{ name: "envsync-db-preupgrade-old.dump.age", mtimeMs: now - 8 * day },
			{ name: "envsync-db-preupgrade-old.identity", mtimeMs: now - 8 * day },
			{ name: "envsync-db-preupgrade-new.dump.age", mtimeMs: now - 2 * day },
			{ name: "envsync-db-preupgrade-new.identity", mtimeMs: now - 2 * day },
			{ name: "notes.txt", mtimeMs: now - 30 * day },
		], 7, now);
		expect(names).toEqual(["envsync-db-preupgrade-old.dump.age", "envsync-db-preupgrade-old.identity"]);

		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-upgrade-prune-"));
		try {
			for (const name of ["envsync-db-preupgrade-old.dump.age", "envsync-db-preupgrade-old.identity", "envsync-db-preupgrade-new.dump.age", "envsync-db-preupgrade-new.identity"]) {
				fs.writeFileSync(path.join(dir, name), "age-encryption.org/v1\n");
			}
			const old = now - 8 * day;
			const recent = now - 2 * day;
			fs.utimesSync(path.join(dir, "envsync-db-preupgrade-old.dump.age"), old / 1000, old / 1000);
			fs.utimesSync(path.join(dir, "envsync-db-preupgrade-old.identity"), old / 1000, old / 1000);
			fs.utimesSync(path.join(dir, "envsync-db-preupgrade-new.dump.age"), recent / 1000, recent / 1000);
			fs.utimesSync(path.join(dir, "envsync-db-preupgrade-new.identity"), recent / 1000, recent / 1000);
			const pruned = pruneUpgradeSnapshots(dir, 7, now);
			expect(pruned.removed.map(file => path.basename(file)).sort()).toEqual([
				"envsync-db-preupgrade-old.dump.age",
				"envsync-db-preupgrade-old.identity",
			]);
			expect(fs.existsSync(path.join(dir, "envsync-db-preupgrade-new.dump.age"))).toBe(true);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	it("seals pre-existing unencrypted preupgrade dumps and reports the count", async () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-upgrade-legacy-"));
		try {
			fs.writeFileSync(path.join(dir, "envsync-db-preupgrade-a.dump"), "dump-a");
			fs.writeFileSync(path.join(dir, "envsync-db-preupgrade-b.dump"), "dump-b");
			fs.writeFileSync(path.join(dir, "envsync-db-preupgrade-keep.dump.age"), "age-encryption.org/v1\n");
			const sealed = await sealPlaintextUpgradeDumps(dir);
			expect(sealed).toHaveLength(2);
			expect(fs.existsSync(path.join(dir, "envsync-db-preupgrade-a.dump"))).toBe(false);
			expect(fs.existsSync(path.join(dir, "envsync-db-preupgrade-b.dump"))).toBe(false);
			expect(fs.existsSync(path.join(dir, "envsync-db-preupgrade-a.dump.age"))).toBe(true);
			expect(fs.existsSync(path.join(dir, "envsync-db-preupgrade-b.dump.age"))).toBe(true);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
