import fs from "node:fs";
import path from "node:path";

/** Env keys that must never be rendered into service environment or deploy.env. */
export const PROTECTED_ENV_KEYS = ["MINIKMS_ROOT_KEY", "MINIKMS_SESSION_SIGNING_KEY"] as const;

export const PROTECTED_SECRET_FILE_MODE = 0o600;
export const PROTECTED_SECRET_DIR_MODE = 0o700;
export const PROTECTED_CERT_FILE_MODE = 0o644;
export const PROTECTED_MATERIAL_ARCHIVE_DIR = "minikms-material";

export type ProtectedService = "minikms" | "api";
export type ProtectedMaterialLocation = "secret" | "deploy";

export interface SwarmSecretMount {
	composeKey: string;
	target: string;
	services: ProtectedService[];
}

export interface ProtectedMaterial {
	id: string;
	fileName: string;
	location: ProtectedMaterialLocation;
	mode: number;
	swarm?: SwarmSecretMount;
}

export interface ProtectedSecretRef {
	id: string;
	file: string;
	secret?: string;
}

export interface MaterialRoots {
	secretDir: string;
	deployRoot: string;
}

/**
 * Private keys live in the secret dir (mode 0600) and are published as Swarm
 * secrets. Certificates stay on the deploy root and are bind-mounted.
 * The grpc CA key is host-only: it signs certs and is not mounted.
 */
export const PROTECTED_MATERIAL: readonly ProtectedMaterial[] = [
	{
		id: "minikms_root_key",
		fileName: "minikms-root-key",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
		swarm: { composeKey: "minikms_root_key", target: "minikms-root-key", services: ["minikms"] },
	},
	{
		id: "minikms_session_signing_key",
		fileName: "minikms-session-signing-key.pem",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
		swarm: {
			composeKey: "minikms_session_signing_key",
			target: "minikms-session-signing-key",
			services: ["minikms"],
		},
	},
	{
		id: "minikms_root_ca_key",
		fileName: "minikms-root-ca-key.pem",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
		swarm: { composeKey: "minikms_root_ca_key", target: "minikms-root-ca-key", services: ["minikms"] },
	},
	{
		id: "minikms_grpc_ca_key",
		fileName: "minikms-grpc-ca-key.pem",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
	},
	{
		id: "minikms_grpc_server_key",
		fileName: "minikms-grpc-server-key.pem",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
		swarm: { composeKey: "minikms_grpc_server_key", target: "minikms-grpc-server-key", services: ["minikms"] },
	},
	{
		id: "minikms_grpc_client_key",
		fileName: "minikms-grpc-client-key.pem",
		location: "secret",
		mode: PROTECTED_SECRET_FILE_MODE,
		swarm: { composeKey: "minikms_grpc_client_key", target: "minikms-grpc-client-key", services: ["api"] },
	},
	{
		id: "minikms_root_ca_cert",
		fileName: "minikms-root-ca-cert.pem",
		location: "deploy",
		mode: PROTECTED_CERT_FILE_MODE,
	},
	{
		id: "minikms_grpc_ca_cert",
		fileName: "minikms-grpc-ca-cert.pem",
		location: "deploy",
		mode: PROTECTED_CERT_FILE_MODE,
	},
	{
		id: "minikms_grpc_server_cert",
		fileName: "minikms-grpc-server-cert.pem",
		location: "deploy",
		mode: PROTECTED_CERT_FILE_MODE,
	},
	{
		id: "minikms_grpc_client_cert",
		fileName: "minikms-grpc-client-cert.pem",
		location: "deploy",
		mode: PROTECTED_CERT_FILE_MODE,
	},
];

export function materialById(id: string): ProtectedMaterial {
	const found = PROTECTED_MATERIAL.find(item => item.id === id);
	if (!found) throw new Error(`Unknown protected material: ${id}`);
	return found;
}

export function swarmSecretName(stackName: string, composeKey: string) {
	return `${stackName}_${composeKey}`;
}

export function materialTarget(roots: MaterialRoots, item: ProtectedMaterial) {
	const root = item.location === "secret" ? roots.secretDir : roots.deployRoot;
	return path.join(root, item.fileName);
}

export function legacyDeployPath(deployRoot: string, item: ProtectedMaterial) {
	return path.join(deployRoot, item.fileName);
}

export function omitProtectedEnv<T extends Record<string, string>>(env: T): T {
	const next = { ...env };
	for (const key of PROTECTED_ENV_KEYS) {
		delete next[key];
	}
	return next;
}

export function protectedSecretRefs(secretDir: string, stackName: string): ProtectedSecretRef[] {
	return PROTECTED_MATERIAL.filter(item => item.location === "secret").map(item => ({
		id: item.id,
		file: path.join(secretDir, item.fileName),
		...(item.swarm ? { secret: swarmSecretName(stackName, item.swarm.composeKey) } : {}),
	}));
}

export function redactProtectedConfigSecrets<S extends {
	minikms_root_key: string;
	minikms_session_signing_key: string;
	protected_secrets?: ProtectedSecretRef[];
}>(secrets: S, secretDir: string, stackName: string): S {
	return {
		...secrets,
		minikms_root_key: "",
		minikms_session_signing_key: "",
		protected_secrets: protectedSecretRefs(secretDir, stackName),
	};
}

/** Swarm secret mounts for one service. Empty when that service has none. */
export function renderServiceSecretBlock(service: ProtectedService): string {
	const secrets = PROTECTED_MATERIAL.filter(item => item.swarm?.services.includes(service));
	if (secrets.length === 0) return "";
	const lines = ["    secrets:"];
	for (const item of secrets) {
		lines.push(`      - source: ${item.swarm!.composeKey}`);
		lines.push(`        target: ${item.swarm!.target}`);
		// 0444 so the unprivileged service user can read the tmpfs mount.
		// miniKMS re-copies mode-checked keys to 0600 before use.
		lines.push("        mode: 0444");
	}
	return lines.join("\n");
}

/** Top-level external Swarm secrets referenced by the given services. */
export function renderSwarmSecretsBlock(stackName: string, services: readonly ProtectedService[]): string {
	const selected = new Set(services);
	const secrets = PROTECTED_MATERIAL.filter(item => item.swarm?.services.some(service => selected.has(service)));
	if (secrets.length === 0) return "";
	const lines = ["secrets:"];
	for (const item of secrets) {
		lines.push(`  ${item.swarm!.composeKey}:`);
		lines.push("    external: true");
		lines.push(`    name: ${swarmSecretName(stackName, item.swarm!.composeKey)}`);
	}
	return lines.join("\n");
}

export function writeProtectedMaterialFile(target: string, content: string, mode: number) {
	const dir = path.dirname(target);
	fs.mkdirSync(dir, { recursive: true });
	if (mode === PROTECTED_SECRET_FILE_MODE) {
		fs.chmodSync(dir, PROTECTED_SECRET_DIR_MODE);
	}
	fs.writeFileSync(target, content, { encoding: "utf8", mode });
	fs.chmodSync(target, mode);
}

export function readExistingMaterial(roots: MaterialRoots, id: string, trim: boolean): string {
	const item = materialById(id);
	const candidates = [materialTarget(roots, item)];
	if (item.location === "secret") candidates.push(legacyDeployPath(roots.deployRoot, item));
	for (const candidate of candidates) {
		if (!fs.existsSync(candidate)) continue;
		const raw = fs.readFileSync(candidate, "utf8");
		if (!raw.trim()) continue;
		return trim ? raw.trim() : raw;
	}
	return "";
}

/** Copy legacy deploy-root private files into the secret dir. Does not delete the legacy path. */
export function migrateLegacySecretFiles(roots: MaterialRoots): string[] {
	const moved: string[] = [];
	for (const item of PROTECTED_MATERIAL) {
		if (item.location !== "secret") continue;
		const target = materialTarget(roots, item);
		const legacy = legacyDeployPath(roots.deployRoot, item);
		if (legacy === target || fs.existsSync(target) || !fs.existsSync(legacy)) continue;
		writeProtectedMaterialFile(target, fs.readFileSync(legacy, "utf8"), item.mode);
		moved.push(legacy);
	}
	return moved;
}

/** Delete legacy private files only after the secret-dir copy exists. */
export function removeLegacySecretFiles(roots: MaterialRoots): string[] {
	const removed: string[] = [];
	for (const item of PROTECTED_MATERIAL) {
		if (item.location !== "secret") continue;
		const target = materialTarget(roots, item);
		const legacy = legacyDeployPath(roots.deployRoot, item);
		if (legacy === target || !fs.existsSync(target) || !fs.existsSync(legacy)) continue;
		fs.rmSync(legacy, { force: true });
		removed.push(legacy);
	}
	return removed;
}

export function enforceProtectedMaterialModes(roots: MaterialRoots) {
	for (const item of PROTECTED_MATERIAL) {
		const target = materialTarget(roots, item);
		if (!fs.existsSync(target)) continue;
		if (item.location === "secret") {
			fs.mkdirSync(roots.secretDir, { recursive: true });
			fs.chmodSync(roots.secretDir, PROTECTED_SECRET_DIR_MODE);
		}
		fs.chmodSync(target, item.mode);
	}
}

export interface ProtectedFileRestore {
	id: string;
	source: string;
	target: string;
	mode: number;
}

export function planProtectedFileRestore(opts: {
	archiveRoot: string;
	secretDir: string;
	deployRoot: string;
}): { files: ProtectedFileRestore[]; dryRunLines: string[] } {
	const roots = { secretDir: opts.secretDir, deployRoot: opts.deployRoot };
	const files = PROTECTED_MATERIAL.map(item => ({
		id: item.id,
		source: path.join(opts.archiveRoot, PROTECTED_MATERIAL_ARCHIVE_DIR, item.fileName),
		target: materialTarget(roots, item),
		mode: item.mode,
	}));
	return {
		files,
		dryRunLines: files.map(file =>
			`Would restore ${file.target} from ${file.source} with mode ${(file.mode & 0o777).toString(8)}`,
		),
	};
}

export function applyProtectedFileRestore(files: readonly ProtectedFileRestore[]): {
	restored: string[];
	missing: string[];
} {
	const restored: string[] = [];
	const missing: string[] = [];
	for (const file of files) {
		if (!fs.existsSync(file.source)) {
			missing.push(file.source);
			continue;
		}
		writeProtectedMaterialFile(file.target, fs.readFileSync(file.source, "utf8"), file.mode);
		restored.push(file.target);
	}
	return { restored, missing };
}

export interface PlannedSwarmSecret {
	id: string;
	name: string;
	file: string;
}

export function planSwarmSecretSync(opts: {
	secretDir: string;
	stackName: string;
	recreate: boolean;
}): { secrets: PlannedSwarmSecret[]; dryRunLines: string[] } {
	const secrets = PROTECTED_MATERIAL.filter(item => item.swarm).map(item => ({
		id: item.id,
		name: swarmSecretName(opts.stackName, item.swarm!.composeKey),
		file: path.join(opts.secretDir, item.fileName),
	}));
	const dryRunLines = secrets.flatMap(secret => opts.recreate
		? [
			`Would run: docker secret rm ${secret.name}`,
			`Would run: docker secret create ${secret.name} ${secret.file}`,
		]
		: [`Would run: docker secret create ${secret.name} ${secret.file} if it does not exist`]);
	return { secrets, dryRunLines };
}
