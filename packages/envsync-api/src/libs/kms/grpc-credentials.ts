import fs from "node:fs";
import * as grpc from "@grpc/grpc-js";

import { assertMinikmsTls, MinikmsTlsError, type MinikmsTlsSettings } from "@/libs/kms/tls-policy";

function readOptionalPem(inline?: string, filePath?: string): Buffer | undefined {
	if (inline && inline.trim()) {
		return Buffer.from(inline);
	}
	if (filePath && filePath.trim()) {
		return fs.readFileSync(filePath);
	}
	return undefined;
}

function readRequiredPem(inline: string | undefined, filePath: string | undefined, label: string): Buffer {
	try {
		const pem = readOptionalPem(inline, filePath);
		if (!pem || pem.length === 0) {
			throw new MinikmsTlsError(`Missing ${label}. Refusing a plaintext miniKMS connection.`);
		}
		return pem;
	} catch (error) {
		if (error instanceof MinikmsTlsError) throw error;
		const reason = error instanceof Error ? error.message : String(error);
		throw new MinikmsTlsError(`Could not read ${label}: ${reason}. Refusing a plaintext miniKMS connection.`);
	}
}

/** Channel credentials for the API's miniKMS connection. Plaintext is refused outside development. */
export function loadMinikmsGrpcCredentials(settings: MinikmsTlsSettings): grpc.ChannelCredentials {
	const mode = assertMinikmsTls(settings);
	if (mode === "insecure") {
		return grpc.credentials.createInsecure();
	}
	const rootCerts = readRequiredPem(settings.MINIKMS_TLS_CA_CERT, settings.MINIKMS_TLS_CA_CERT_FILE, "miniKMS CA certificate");
	const clientCert = readRequiredPem(
		settings.MINIKMS_TLS_CLIENT_CERT,
		settings.MINIKMS_TLS_CLIENT_CERT_FILE,
		"miniKMS client certificate",
	);
	const clientKey = readRequiredPem(settings.MINIKMS_TLS_CLIENT_KEY, settings.MINIKMS_TLS_CLIENT_KEY_FILE, "miniKMS client key");
	return grpc.credentials.createSsl(rootCerts, clientKey, clientCert);
}
