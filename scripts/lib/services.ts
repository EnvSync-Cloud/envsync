/**
 * Shared service utilities used by both scripts/cli.ts and scripts/e2e-setup.ts.
 *
 * Extracted to avoid duplication of service health checks and env file parsing.
 */

import fs from "node:fs";
import net from "node:net";

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
		const escaped = value.includes(" ") || value.includes("#")
			? `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`
			: value;
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
	const p = port ?? parseInt(process.env.MAILPIT_SMTP_PORT ?? "1025", 10);
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

// ── miniKMS helpers ─────────────────────────────────────────────────

export async function waitForMiniKMS(host?: string, port?: number): Promise<void> {
	const h = host ?? "localhost";
	const p = port ?? parseInt(process.env.MINIKMS_GRPC_PORT ?? "50051", 10);
	await waitFor(
		"miniKMS",
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
		3000,
		20,
	);
}

// ── Keycloak helpers ────────────────────────────────────────────────

export async function waitForKeycloak(url?: string, realm?: string): Promise<void> {
	const base = (url ?? process.env.KEYCLOAK_URL ?? "http://localhost:8080").replace(/\/$/, "");
	const keycloakRealm = realm ?? process.env.KEYCLOAK_REALM ?? "envsync";
	const checkUrl = base.includes("keycloak:") ? "http://localhost:8080" : base;
	await waitFor(
		"Keycloak",
		async () => {
			try {
				const res = await fetch(`${checkUrl}/realms/${keycloakRealm}/.well-known/openid-configuration`, {
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
