import fs from "node:fs";
import path from "node:path";

const TURBO_JSON = "turbo.json";

/**
 * Find monorepo root by walking up from cwd until we find turbo.json.
 */
export function findMonorepoRoot(from = process.cwd()): string {
	let dir = path.resolve(from);
	for (;;) {
		if (fs.existsSync(path.join(dir, TURBO_JSON))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			return from;
		}
		dir = parent;
	}
}

/**
 * Parse a .env-style file (KEY=value, # comments, blank lines).
 */
function parseEnvFile(content: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
		}
		out[key] = value;
	}
	return out;
}

/**
 * Load .env from monorepo root into process.env.
 * Call this before parsing config so all packages use root env when run from anywhere in the repo.
 */
export function loadRootEnv(): void {
	const root = findMonorepoRoot();
	const envPath = path.join(root, ".env");
	if (!fs.existsSync(envPath)) return;
	const content = fs.readFileSync(envPath, "utf8");
	const parsed = parseEnvFile(content);
	for (const [key, value] of Object.entries(parsed)) {
		if (key && value !== undefined) process.env[key] = value;
	}
}

/**
 * Update or add keys in the root .env file. Preserves existing lines and order; appends new keys.
 */
export function updateRootEnv(updates: Record<string, string>): void {
	if (Object.keys(updates).length === 0) return;
	const root = findMonorepoRoot();
	const envPath = path.join(root, ".env");
	const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
	const lines = content.split(/\r?\n/);
	const keyToLineIndex = new Map<string, number>();
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
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
	fs.writeFileSync(envPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
}
