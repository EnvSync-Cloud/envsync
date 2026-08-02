/**
 * Self-host first-org / multi-org operator helpers (Phase 1b).
 * Calls core API setup routes with X-EnvSync-Setup-Token.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export const SETUP_TOKEN_HEADER = "X-EnvSync-Setup-Token";

export type SetupStatus = {
	deployment_mode: "hosted" | "selfhosted";
	edition: "oss" | "enterprise";
	org_count: number;
	max_orgs: number | null;
	can_create_organization: boolean;
	first_org_ready: boolean;
	channel: string;
};

export type CreateOrgInput = {
	org_name: string;
	org_slug?: string;
	admin_email: string;
	admin_full_name?: string;
	admin_password: string;
};

export function generateSetupToken(): string {
	return `es_setup_${randomBytes(24).toString("hex")}`;
}

export function ensureSetupTokenFile(tokenFile: string, existingToken?: string): string {
	if (existingToken?.trim()) {
		const dir = path.dirname(tokenFile);
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		fs.writeFileSync(tokenFile, `${existingToken.trim()}\n`, { mode: 0o600 });
		return existingToken.trim();
	}
	if (fs.existsSync(tokenFile)) {
		const fromFile = fs.readFileSync(tokenFile, "utf8").trim();
		if (fromFile.length >= 16) {
			return fromFile;
		}
	}
	const token = generateSetupToken();
	const dir = path.dirname(tokenFile);
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
	return token;
}

export function readSetupTokenFile(tokenFile: string): string | null {
	if (!fs.existsSync(tokenFile)) {
		return null;
	}
	const token = fs.readFileSync(tokenFile, "utf8").trim();
	return token.length >= 16 ? token : null;
}

export function setupTokenFingerprint(token: string): string {
	return createHash("sha256").update(token).digest("hex").slice(0, 12);
}

export async function fetchSetupStatus(apiBaseUrl: string, setupToken: string): Promise<SetupStatus> {
	const base = apiBaseUrl.replace(/\/$/, "");
	const response = await fetch(`${base}/api/setup/status`, {
		method: "GET",
		headers: {
			[SETUP_TOKEN_HEADER]: setupToken,
		},
	});
	const body = (await response.json().catch(() => ({}))) as SetupStatus & { error?: string; code?: string };
	if (!response.ok) {
		throw new Error(body.error || `Setup status failed (${response.status})`);
	}
	return body;
}

export async function createOrgViaSetup(
	apiBaseUrl: string,
	setupToken: string,
	input: CreateOrgInput,
): Promise<{ org_id: string; admin_user_id: string; first_org: boolean; source: string }> {
	const base = apiBaseUrl.replace(/\/$/, "");
	const response = await fetch(`${base}/api/setup/org`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			[SETUP_TOKEN_HEADER]: setupToken,
		},
		body: JSON.stringify(input),
	});
	const body = (await response.json().catch(() => ({}))) as {
		org_id?: string;
		admin_user_id?: string;
		first_org?: boolean;
		source?: string;
		error?: string;
		code?: string;
	};
	if (!response.ok) {
		throw new Error(body.error || `Create organization failed (${response.status}${body.code ? `: ${body.code}` : ""})`);
	}
	if (!body.org_id || !body.admin_user_id) {
		throw new Error("Create organization response missing org_id or admin_user_id");
	}
	return {
		org_id: body.org_id,
		admin_user_id: body.admin_user_id,
		first_org: Boolean(body.first_org),
		source: body.source ?? "selfhost_cli",
	};
}

function ask(rl: readline.Interface, question: string, fallback = ""): Promise<string> {
	return new Promise(resolve => {
		rl.question(question, answer => {
			const value = answer.trim();
			resolve(value || fallback);
		});
	});
}

function askHidden(rl: readline.Interface, question: string): Promise<string> {
	return new Promise(resolve => {
		const stdin = process.stdin;
		const wasRaw = stdin.isRaw;
		if (stdin.isTTY) {
			stdin.setRawMode?.(true);
		}
		process.stdout.write(question);
		let value = "";
		const onData = (chunk: Buffer) => {
			const s = chunk.toString("utf8");
			if (s === "\n" || s === "\r" || s === "\u0004") {
				stdin.off("data", onData);
				if (stdin.isTTY) {
					stdin.setRawMode?.(wasRaw ?? false);
				}
				process.stdout.write("\n");
				resolve(value);
				return;
			}
			if (s === "\u0003") {
				process.exit(130);
			}
			if (s === "\u007f" || s === "\b") {
				value = value.slice(0, -1);
				return;
			}
			value += s;
		};
		stdin.on("data", onData);
	});
}

export async function promptCreateOrgInteractive(): Promise<CreateOrgInput> {
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	try {
		const org_name = await ask(rl, "Organization name: ");
		if (!org_name) {
			throw new Error("Organization name is required.");
		}
		const org_slug = await ask(rl, "Organization slug (optional): ");
		const admin_email = await ask(rl, "Admin email: ");
		if (!admin_email) {
			throw new Error("Admin email is required.");
		}
		const admin_full_name = await ask(rl, "Admin full name (optional): ", admin_email);
		rl.close();
		const admin_password = await askHidden(
			readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true }),
			"Admin password: ",
		);
		if (!admin_password) {
			throw new Error("Admin password is required.");
		}
		return {
			org_name,
			org_slug: org_slug || undefined,
			admin_email,
			admin_full_name,
			admin_password,
		};
	} finally {
		try {
			rl.close();
		} catch {
			/* ignore */
		}
	}
}

export function parseOrgCreateArgs(args: string[]): CreateOrgInput & { interactive: boolean; json: boolean } {
	const get = (flag: string) => {
		const idx = args.indexOf(flag);
		if (idx === -1) return undefined;
		return args[idx + 1];
	};
	const interactive = args.includes("--interactive") || args.includes("-i");
	const json = args.includes("--json");
	return {
		org_name: get("--name") ?? get("--org-name") ?? "",
		org_slug: get("--slug") ?? get("--org-slug"),
		admin_email: get("--email") ?? get("--admin-email") ?? "",
		admin_full_name: get("--full-name") ?? get("--admin-full-name"),
		admin_password: get("--password") ?? get("--admin-password") ?? "",
		interactive,
		json,
	};
}
