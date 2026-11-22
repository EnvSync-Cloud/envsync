import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
	applyProtectedFileRestore,
	planProtectedFileRestore,
	planSwarmSecretSync,
	PROTECTED_MATERIAL,
	PROTECTED_MATERIAL_ARCHIVE_DIR,
	redactProtectedConfigSecrets,
	writeProtectedMaterialFile,
} from "./protected-secrets";

const SENTINEL_ROOT_KEY = "SENTINEL_ROOT_KEY_DO_NOT_LEAK";
const SENTINEL_SESSION_KEY = "SENTINEL_SESSION_SIGNING_KEY_DO_NOT_LEAK";

describe("protected secret restore", () => {
	test("re-creates PEM files and Swarm secrets without logging key material", () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "envsync-protected-restore-"));
		try {
			const archiveRoot = path.join(root, "archive");
			const secretDir = path.join(root, "etc", "minikms");
			const deployRoot = path.join(root, "deploy");
			const archiveDir = path.join(archiveRoot, PROTECTED_MATERIAL_ARCHIVE_DIR);
			fs.mkdirSync(archiveDir, { recursive: true });
			for (const item of PROTECTED_MATERIAL) {
				const body = item.id === "minikms_root_key"
					? SENTINEL_ROOT_KEY
					: item.id === "minikms_session_signing_key"
						? SENTINEL_SESSION_KEY
						: `SENTINEL_${item.id}_DO_NOT_LEAK`;
				writeProtectedMaterialFile(path.join(archiveDir, item.fileName), `${body}\n`, item.mode);
			}

			const filePlan = planProtectedFileRestore({ archiveRoot, secretDir, deployRoot });
			const swarmPlan = planSwarmSecretSync({ secretDir, stackName: "envsync", recreate: true });
			const dryRun = [...filePlan.dryRunLines, ...swarmPlan.dryRunLines].join("\n");
			expect(dryRun).toContain("Would restore");
			expect(dryRun).toContain("minikms-session-signing-key.pem");
			expect(dryRun).toContain("minikms-root-ca-key.pem");
			expect(dryRun).toContain("minikms-grpc-client-key.pem");
			expect(dryRun).toContain("with mode 600");
			expect(dryRun).toContain("docker secret rm envsync_minikms_root_key");
			expect(dryRun).toContain(`docker secret create envsync_minikms_root_key ${path.join(secretDir, "minikms-root-key")}`);
			expect(dryRun).toContain("docker secret create envsync_minikms_session_signing_key");
			expect(dryRun).toContain("docker secret create envsync_minikms_grpc_client_key");
			expect(dryRun).not.toContain(SENTINEL_ROOT_KEY);
			expect(dryRun).not.toContain(SENTINEL_SESSION_KEY);
			expect(dryRun).not.toContain("DO_NOT_LEAK");

			const applied = applyProtectedFileRestore(filePlan.files);
			expect(applied.missing).toEqual([]);
			expect(applied.restored.length).toBe(PROTECTED_MATERIAL.length);

			const rootKeyPath = path.join(secretDir, "minikms-root-key");
			const sessionPath = path.join(secretDir, "minikms-session-signing-key.pem");
			const clientKeyPath = path.join(secretDir, "minikms-grpc-client-key.pem");
			const certPath = path.join(deployRoot, "minikms-grpc-server-cert.pem");
			expect(fs.readFileSync(rootKeyPath, "utf8").trim()).toBe(SENTINEL_ROOT_KEY);
			expect(fs.readFileSync(sessionPath, "utf8").trim()).toBe(SENTINEL_SESSION_KEY);
			expect(fs.statSync(rootKeyPath).mode & 0o777).toBe(0o600);
			expect(fs.statSync(sessionPath).mode & 0o777).toBe(0o600);
			expect(fs.statSync(clientKeyPath).mode & 0o777).toBe(0o600);
			expect(fs.statSync(secretDir).mode & 0o777).toBe(0o700);
			expect(fs.statSync(certPath).mode & 0o777).toBe(0o644);

			const persisted = JSON.stringify(redactProtectedConfigSecrets({
				minikms_root_key: SENTINEL_ROOT_KEY,
				minikms_session_signing_key: SENTINEL_SESSION_KEY,
				minikms_db_password: "kept-db-password",
			}, secretDir, "envsync"));
			expect(persisted).not.toContain(SENTINEL_ROOT_KEY);
			expect(persisted).not.toContain(SENTINEL_SESSION_KEY);
			expect(persisted).toContain("envsync_minikms_root_key");
			expect(persisted).toContain(path.join(secretDir, "minikms-root-key"));
			expect(persisted).toContain(path.join(secretDir, "minikms-session-signing-key.pem"));
			expect(persisted).toContain("kept-db-password");
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
