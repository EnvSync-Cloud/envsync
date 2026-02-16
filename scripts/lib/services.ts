/**
 * Shared service utilities used by both scripts/cli.ts and scripts/e2e-setup.ts.
 *
 * Extracted to avoid duplication of service health checks, env file parsing,
 * and Vault initialization logic.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

// ── Env file utilities ──────────────────────────────────────────────

export function loadEnvFile(filePath: string): void {
	if (!fs.existsSync(filePath)) return;
	const content = fs.readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		if (key) process.env[key] = value;
	}
}

/** Update or create an .env-style file with key=value pairs. */
export function updateEnvFile(filePath: string, updates: Record<string, string>): void {
	if (Object.keys(updates).length === 0) return;
	const content = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
	const lines = content.split(/\r?\n/);
	const keyToLineIndex = new Map<string, number>();
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const eq = line.indexOf("=");
		if (eq > 0) {
			const key = line.slice(0, eq).trim();
			if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) keyToLineIndex.set(key, i);
		}
	}
	for (const [key, value] of Object.entries(updates)) {
		const escaped = value.includes(" ") || value.includes("#") ? `"${value.replace(/"/g, '\\"')}"` : value;
		if (keyToLineIndex.has(key)) {
			lines[keyToLineIndex.get(key)!] = `${key}=${escaped}`;
		} else {
			lines.push(`${key}=${escaped}`);
		}
	}
	fs.writeFileSync(filePath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
}

// ── Service health check utilities ──────────────────────────────────

export function waitFor(
	label: string,
	check: () => Promise<boolean>,
	intervalMs: number,
	maxAttempts: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let attempts = 0;
		const run = async () => {
			try {
				if (await check()) {
					console.log(`${label} is ready.`);
					return resolve();
				}
			} catch (_) {}
			attempts++;
			if (attempts >= maxAttempts) return reject(new Error(`${label} did not become ready in time.`));
			setTimeout(run, intervalMs);
		};
		run();
	});
}

export async function waitForPostgres(host?: string, port?: number): Promise<void> {
	const h = host ?? process.env.DATABASE_HOST ?? "localhost";
	const p = port ?? parseInt(process.env.DATABASE_PORT ?? "5432", 10);
	await waitFor(
		"Postgres",
		() =>
			new Promise<boolean>(resolve => {
				const s = net.createConnection(p, h, () => {
					s.destroy();
					resolve(true);
				});
				s.on("error", () => resolve(false));
				s.setTimeout(2000, () => {
					s.destroy();
					resolve(false);
				});
			}),
		2000,
		30,
	);
}

export async function waitForVault(vaultAddr?: string): Promise<void> {
	const addr = (vaultAddr ?? process.env.VAULT_ADDR ?? `http://localhost:${process.env.VAULT_PORT ?? "8200"}`).replace(/\/$/, "");
	await waitFor(
		"Vault",
		async () => {
			try {
				const res = await fetch(`${addr}/v1/sys/health`, {
					signal: AbortSignal.timeout(3000),
				});
				return res.status !== undefined;
			} catch {
				return false;
			}
		},
		3000,
		30,
	);
}

export async function waitForOpenFGA(openfgaUrl?: string): Promise<void> {
	const url = (openfgaUrl ?? process.env.OPENFGA_API_URL ?? `http://localhost:${process.env.OPENFGA_HTTP_PORT ?? "8090"}`).replace(/\/$/, "");
	await waitFor(
		"OpenFGA",
		async () => {
			try {
				const res = await fetch(`${url}/healthz`, {
					signal: AbortSignal.timeout(3000),
				});
				return res.ok;
			} catch {
				return false;
			}
		},
		3000,
		30,
	);
}

export async function waitForMailpit(host?: string, port?: number): Promise<void> {
	const h = host ?? "localhost";
	const p = port ?? 1025;
	await waitFor(
		"Mailpit",
		() =>
			new Promise<boolean>(resolve => {
				const s = net.createConnection(p, h, () => {
					s.destroy();
					resolve(true);
				});
				s.on("error", () => resolve(false));
				s.setTimeout(2000, () => {
					s.destroy();
					resolve(false);
				});
			}),
		2000,
		15,
	);
}

// ── Zitadel helpers ─────────────────────────────────────────────────

export async function waitForZitadel(url?: string): Promise<void> {
	const base = (url ?? process.env.ZITADEL_URL ?? "http://localhost:8080").replace(/\/$/, "");
	// When running from host, ZITADEL_URL in .env might be http://zitadel:8080; try localhost for port check
	const checkUrl = base.includes("zitadel:") ? "http://localhost:8080" : base;
	await waitFor(
		"Zitadel",
		async () => {
			try {
				const res = await fetch(`${checkUrl}/.well-known/openid-configuration`, {
					signal: AbortSignal.timeout(5000),
				});
				return res.ok;
			} catch {
				return false;
			}
		},
		5000,
		60,
	);
}

async function readFileFromZitadelVolume(rootDir: string, fileName: string): Promise<string | null> {
	const projectName = process.env.COMPOSE_PROJECT_NAME ?? path.basename(rootDir);
	const volumeName = `${projectName}_zitadel_data`;
	const maxAttempts = 5;
	const delayMs = 4000;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const result = spawnSync(
			"docker",
			["run", "--rm", "-v", `${volumeName}:/data:ro`, "alpine", "cat", `/data/${fileName}`],
			{ cwd: rootDir, encoding: "utf8", env: process.env },
		);
		if (result.status === 0 && result.stdout?.trim()) {
			return result.stdout.trim();
		}
		if (attempt < maxAttempts) {
			console.log(
				`Zitadel: ${fileName} not ready yet (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs / 1000}s...`,
			);
			await new Promise(r => setTimeout(r, delayMs));
		}
	}
	return null;
}

/** Read Zitadel admin PAT from the zitadel_data Docker volume (admin.pat from first-instance machine user). */
export async function readPatFromVolume(rootDir: string): Promise<string | null> {
	return readFileFromZitadelVolume(rootDir, "admin.pat");
}

/** Read Zitadel login-client PAT from the zitadel_data Docker volume (login-client.pat). */
export async function readLoginPatFromVolume(rootDir: string): Promise<string | null> {
	return readFileFromZitadelVolume(rootDir, "login-client.pat");
}

// ── Vault initialization ────────────────────────────────────────────

export interface VaultInitResult {
	rootToken: string;
	unsealKey: string;
	roleId: string;
	secretId: string;
	vaultAddr: string;
	mountPath: string;
}

/**
 * Initialize and configure Vault:
 * 1. Check init status; init if needed (1 key share, 1 threshold)
 * 2. Unseal if sealed
 * 3. Enable KV v2 secrets engine
 * 4. Enable AppRole auth method
 * 5. Create policy + role
 * 6. Get role_id and generate secret_id
 *
 * Returns generated credentials.
 */
export async function initVault(vaultAddr: string, mountPath: string, policyName = "envsync-api", roleName = "envsync-api"): Promise<VaultInitResult> {
	vaultAddr = vaultAddr.replace(/\/$/, "");

	console.log(`\nInitializing Vault at ${vaultAddr}...`);

	let rootToken = process.env.VAULT_TOKEN || "";
	let unsealKey = process.env.VAULT_UNSEAL_KEY || "";

	async function vaultFetch(path: string, opts: RequestInit = {}): Promise<Response> {
		return fetch(`${vaultAddr}${path}`, {
			...opts,
			headers: {
				"Content-Type": "application/json",
				...(rootToken ? { "X-Vault-Token": rootToken } : {}),
				...(opts.headers || {}),
			},
			signal: AbortSignal.timeout(10000),
		});
	}

	// Step 1: Check initialization status
	const initRes = await vaultFetch("/v1/sys/init");
	const { initialized } = (await initRes.json()) as { initialized: boolean };

	if (!initialized) {
		console.log("  Vault is not initialized. Initializing (1 key share, 1 threshold)...");
		const initResp = await vaultFetch("/v1/sys/init", {
			method: "PUT",
			body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 }),
		});
		if (!initResp.ok) {
			throw new Error(`Vault init failed (${initResp.status}): ${await initResp.text()}`);
		}
		const initData = (await initResp.json()) as {
			keys: string[];
			keys_base64: string[];
			root_token: string;
		};
		rootToken = initData.root_token;
		unsealKey = initData.keys_base64[0] || initData.keys[0] || "";
		console.log("  Vault initialized. Root token and unseal key obtained.");
	} else {
		console.log("  Vault is already initialized.");
		if (!rootToken) {
			console.log("  WARNING: VAULT_TOKEN not set. If Vault is sealed, unseal will fail.");
		}
	}

	// Step 2: Unseal if sealed
	const healthRes = await vaultFetch("/v1/sys/health");
	if (healthRes.status === 503) {
		if (!unsealKey) {
			throw new Error("Vault is sealed but no unseal key is available.");
		}
		console.log("  Vault is sealed. Unsealing...");
		const unsealRes = await vaultFetch("/v1/sys/unseal", {
			method: "PUT",
			body: JSON.stringify({ key: unsealKey }),
		});
		if (!unsealRes.ok) {
			throw new Error(`Vault unseal failed (${unsealRes.status}): ${await unsealRes.text()}`);
		}
		console.log("  Vault unsealed.");
	} else if (healthRes.status === 200 || healthRes.status === 429) {
		console.log("  Vault is unsealed and ready.");
	}

	if (!rootToken) {
		throw new Error("Cannot configure Vault without root token. Set VAULT_TOKEN and re-run.");
	}

	// Step 3: Enable KV v2
	console.log(`  Enabling KV v2 secrets engine at "${mountPath}/"...`);
	const mountRes = await vaultFetch(`/v1/sys/mounts/${mountPath}`, {
		method: "POST",
		body: JSON.stringify({ type: "kv", options: { version: "2" } }),
	});
	if (mountRes.ok) {
		console.log(`  KV v2 engine enabled at "${mountPath}/".`);
	} else if (mountRes.status === 400) {
		const body = await mountRes.text();
		if (body.includes("existing mount")) {
			console.log(`  KV v2 engine already mounted at "${mountPath}/".`);
		} else {
			throw new Error(`Failed to enable KV v2: ${body}`);
		}
	} else {
		throw new Error(`Failed to enable KV v2 (${mountRes.status}): ${await mountRes.text()}`);
	}

	// Step 4: Enable AppRole
	console.log("  Enabling AppRole auth method...");
	const authRes = await vaultFetch("/v1/sys/auth/approle", {
		method: "POST",
		body: JSON.stringify({ type: "approle" }),
	});
	if (authRes.ok) {
		console.log("  AppRole auth method enabled.");
	} else if (authRes.status === 400) {
		const body = await authRes.text();
		if (body.includes("existing mount")) {
			console.log("  AppRole auth method already enabled.");
		} else {
			throw new Error(`Failed to enable AppRole: ${body}`);
		}
	} else {
		throw new Error(`Failed to enable AppRole (${authRes.status}): ${await authRes.text()}`);
	}

	// Step 5: Create policy
	console.log(`  Creating Vault policy '${policyName}'...`);
	const policy = `
# Allow full CRUD on the ${mountPath} KV v2 secrets engine
path "${mountPath}/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "${mountPath}/metadata/*" {
  capabilities = ["read", "delete", "list"]
}
path "${mountPath}/delete/*" {
  capabilities = ["update"]
}
path "${mountPath}/undelete/*" {
  capabilities = ["update"]
}
path "${mountPath}/destroy/*" {
  capabilities = ["update"]
}
# Allow token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
# Allow health check
path "sys/health" {
  capabilities = ["read"]
}
`.trim();

	const policyRes = await vaultFetch(`/v1/sys/policy/${policyName}`, {
		method: "PUT",
		body: JSON.stringify({ policy }),
	});
	if (!policyRes.ok) {
		throw new Error(`Failed to create policy (${policyRes.status}): ${await policyRes.text()}`);
	}
	console.log(`  Policy '${policyName}' created.`);

	// Step 6: Create AppRole role
	console.log(`  Creating AppRole role '${roleName}'...`);
	const roleRes = await vaultFetch(`/v1/auth/approle/role/${roleName}`, {
		method: "POST",
		body: JSON.stringify({
			token_policies: [policyName],
			token_ttl: "1h",
			token_max_ttl: "4h",
			secret_id_ttl: "0",
			secret_id_num_uses: 0,
		}),
	});
	if (!roleRes.ok) {
		throw new Error(`Failed to create AppRole role (${roleRes.status}): ${await roleRes.text()}`);
	}
	console.log(`  AppRole role '${roleName}' created.`);

	// Step 7: Get role_id
	const roleIdRes = await vaultFetch(`/v1/auth/approle/role/${roleName}/role-id`);
	if (!roleIdRes.ok) {
		throw new Error(`Failed to get role_id (${roleIdRes.status}): ${await roleIdRes.text()}`);
	}
	const { data: roleIdData } = (await roleIdRes.json()) as { data: { role_id: string } };
	const roleId = roleIdData.role_id;
	console.log(`  Role ID: ${roleId}`);

	// Step 8: Generate secret_id
	const secretIdRes = await vaultFetch(`/v1/auth/approle/role/${roleName}/secret-id`, {
		method: "POST",
		body: JSON.stringify({}),
	});
	if (!secretIdRes.ok) {
		throw new Error(`Failed to generate secret_id (${secretIdRes.status}): ${await secretIdRes.text()}`);
	}
	const { data: secretIdData } = (await secretIdRes.json()) as { data: { secret_id: string } };
	const secretId = secretIdData.secret_id;
	console.log(`  Secret ID: ${secretId.slice(0, 8)}...`);

	return { rootToken, unsealKey, roleId, secretId, vaultAddr, mountPath };
}
