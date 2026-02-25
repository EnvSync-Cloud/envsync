/**
 * Shared service utilities used by both scripts/cli.ts and scripts/e2e-setup.ts.
 *
 * Extracted to avoid duplication of service health checks, env file parsing,
 * and initialization logic.
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

export async function waitForKeycloak(url?: string): Promise<void> {
	const base = (url ?? process.env.KEYCLOAK_URL ?? "http://localhost:8080").replace(/\/$/, "");
	const realm = process.env.KEYCLOAK_REALM ?? "envsync";
	// When running from host, KEYCLOAK_URL in .env might be http://keycloak:8080; try localhost
	const checkUrl = base.includes("keycloak:") ? "http://localhost:8080" : base;
	await waitFor(
		"Keycloak",
		async () => {
			try {
				const res = await fetch(`${checkUrl}/realms/${realm}/.well-known/openid-configuration`, {
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

// ── Grafana helpers ─────────────────────────────────────────────────

export async function waitForGrafana(grafanaUrl?: string): Promise<void> {
	const url = (grafanaUrl ?? `http://localhost:${process.env.GRAFANA_PORT ?? "3302"}`).replace(/\/$/, "");
	await waitFor(
		"Grafana",
		async () => {
			try {
				const res = await fetch(`${url}/api/health`, {
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

export async function waitForSpacetimeDB(url?: string): Promise<void> {
	const stdbUrl = (url ?? process.env.STDB_URL ?? `http://localhost:${process.env.STDB_PORT ?? "1234"}`).replace(/\/$/, "");
	const checkUrl = stdbUrl.includes("spacetimedb:") ? "http://localhost:1234" : stdbUrl;
	await waitFor(
		"SpacetimeDB",
		async () => {
			try {
				const res = await fetch(`${checkUrl}/v1/ping`, {
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
