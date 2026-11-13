import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateEcPrivateKey, generateMinikmsGrpcTlsPemSet, writePrivateKeyFile } from "./minikms-tls";

describe("private key file mode", () => {
	test("writePrivateKeyFile uses mode 0600", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-key-mode-"));
		try {
			const target = path.join(dir, "nested", "key.pem");
			writePrivateKeyFile(target, "-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n");
			expect(fs.statSync(target).mode & 0o777).toBe(0o600);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("generateEcPrivateKey uses mode 0600", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-ec-key-"));
		try {
			const target = path.join(dir, "key.pem");
			generateEcPrivateKey(target, "prime256v1");
			expect(fs.statSync(target).mode & 0o777).toBe(0o600);
			expect(fs.readFileSync(target, "utf8")).toContain("PRIVATE KEY");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("generateMinikmsGrpcTlsPemSet", () => {
	test("emits matching P-256 CA, server (SAN), and client PEMs", () => {
		const pems = generateMinikmsGrpcTlsPemSet();
		expect(pems.caCert).toContain("BEGIN CERTIFICATE");
		expect(pems.caKey).toContain("BEGIN EC PRIVATE KEY");
		expect(pems.serverCert).toContain("BEGIN CERTIFICATE");
		expect(pems.serverKey).toContain("BEGIN EC PRIVATE KEY");
		expect(pems.clientCert).toContain("BEGIN CERTIFICATE");
		expect(pems.clientKey).toContain("BEGIN EC PRIVATE KEY");

		const text = spawnSync("openssl", ["x509", "-noout", "-text"], {
			encoding: "utf8",
			input: pems.serverCert,
		});
		expect(text.status).toBe(0);
		expect(text.stdout).toContain("DNS:minikms");
		expect(text.stdout).toContain("DNS:localhost");
		expect(text.stdout).toContain("IP Address:127.0.0.1");

		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-minikms-verify-"));
		try {
			const caFile = path.join(dir, "ca.pem");
			const serverFile = path.join(dir, "server.pem");
			fs.writeFileSync(caFile, pems.caCert);
			fs.writeFileSync(serverFile, pems.serverCert);
			const verify = spawnSync("openssl", ["verify", "-CAfile", caFile, serverFile], { encoding: "utf8" });
			expect(verify.status).toBe(0);
			expect(verify.stdout).toContain("OK");
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});
});
