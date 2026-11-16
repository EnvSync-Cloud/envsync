import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PRIVATE_KEY_FILE_MODE = 0o600;

export function writePrivateKeyFile(target: string, content: string) {
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content, { encoding: "utf8", mode: PRIVATE_KEY_FILE_MODE });
	fs.chmodSync(target, PRIVATE_KEY_FILE_MODE);
}

function openssl(args: string[], input?: string): string {
	const result = spawnSync("openssl", args, { encoding: "utf8", input });
	if (result.status !== 0) {
		throw new Error(`openssl ${args[0]} failed: ${result.stderr || result.stdout || "unknown error"}`);
	}
	return result.stdout;
}

/** Generate an EC private key and restrict it to mode 0600. */
export function generateEcPrivateKey(filePath: string, curve: string) {
	openssl(["ecparam", "-name", curve, "-genkey", "-noout", "-out", filePath]);
	fs.chmodSync(filePath, PRIVATE_KEY_FILE_MODE);
}

/** P-256 control-plane CA + server/client PEMs. Uses -extfile so OpenSSL 1.1.1 and LibreSSL work. */
export function generateMinikmsGrpcTlsPemSet(): {
	caCert: string;
	caKey: string;
	serverCert: string;
	serverKey: string;
	clientCert: string;
	clientKey: string;
} {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-minikms-grpc-"));
	try {
		const caKeyPath = path.join(tmpDir, "ca.key");
		const caCertPath = path.join(tmpDir, "ca.crt");
		const serverKeyPath = path.join(tmpDir, "server.key");
		const serverCsrPath = path.join(tmpDir, "server.csr");
		const serverExtPath = path.join(tmpDir, "server.ext");
		const serverCertPath = path.join(tmpDir, "server.crt");
		const clientKeyPath = path.join(tmpDir, "client.key");
		const clientCsrPath = path.join(tmpDir, "client.csr");
		const clientExtPath = path.join(tmpDir, "client.ext");
		const clientCertPath = path.join(tmpDir, "client.crt");

		generateEcPrivateKey(caKeyPath, "prime256v1");
		openssl([
			"req", "-new", "-x509", "-key", caKeyPath, "-sha256", "-days", "3650",
			"-subj", "/CN=EnvSync miniKMS gRPC CA", "-out", caCertPath,
		]);

		generateEcPrivateKey(serverKeyPath, "prime256v1");
		openssl(["req", "-new", "-key", serverKeyPath, "-subj", "/CN=minikms", "-out", serverCsrPath]);
		fs.writeFileSync(
			serverExtPath,
			"subjectAltName=DNS:minikms,DNS:localhost,IP:127.0.0.1\n",
		);
		openssl([
			"x509", "-req", "-in", serverCsrPath, "-CA", caCertPath, "-CAkey", caKeyPath,
			"-CAcreateserial", "-days", "3650", "-sha256", "-extfile", serverExtPath, "-out", serverCertPath,
		]);

		generateEcPrivateKey(clientKeyPath, "prime256v1");
		openssl(["req", "-new", "-key", clientKeyPath, "-subj", "/CN=envsync-api", "-out", clientCsrPath]);
		fs.writeFileSync(clientExtPath, "extendedKeyUsage=clientAuth\n");
		openssl([
			"x509", "-req", "-in", clientCsrPath, "-CA", caCertPath, "-CAkey", caKeyPath,
			"-CAcreateserial", "-days", "3650", "-sha256", "-extfile", clientExtPath, "-out", clientCertPath,
		]);

		return {
			caCert: fs.readFileSync(caCertPath, "utf8"),
			caKey: fs.readFileSync(caKeyPath, "utf8"),
			serverCert: fs.readFileSync(serverCertPath, "utf8"),
			serverKey: fs.readFileSync(serverKeyPath, "utf8"),
			clientCert: fs.readFileSync(clientCertPath, "utf8"),
			clientKey: fs.readFileSync(clientKeyPath, "utf8"),
		};
	} finally {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}
