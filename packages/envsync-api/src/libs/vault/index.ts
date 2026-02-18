import infoLogs, { LogTypes } from "@/libs/logger";
import { config } from "@/utils/env";

export interface VaultKVReadResult {
	data: Record<string, any>;
	metadata: {
		version: number;
		created_time: string;
		deletion_time: string;
		destroyed: boolean;
		custom_metadata: Record<string, string> | null;
	};
}

export class VaultClient {
	private static instance: Promise<VaultClient> | undefined;

	private token: string = "";
	private renewalTimer: ReturnType<typeof setInterval> | null = null;

	private readonly addr: string;
	private readonly roleId: string;
	private readonly secretId: string;
	private readonly namespace: string;

	private constructor() {
		this.addr = config.VAULT_ADDR.replace(/\/$/, "");
		this.roleId = config.VAULT_ROLE_ID;
		this.secretId = config.VAULT_SECRET_ID;
		this.namespace = config.VAULT_NAMESPACE || "";
	}

	static getInstance(): Promise<VaultClient> {
		this.instance ??= this._getInstance().catch(err => {
			// Reset singleton so the next call retries (e.g. Vault was sealed at startup)
			this.instance = undefined;
			throw err;
		});
		return this.instance;
	}

	private static async _getInstance(): Promise<VaultClient> {
		const client = new VaultClient();
		await client.tryUnseal();
		await client.authenticate();
		infoLogs("Vault connected via AppRole", LogTypes.LOGS, "Vault");
		return client;
	}

	private async tryUnseal(): Promise<void> {
		const unsealKey = config.VAULT_UNSEAL_KEY;
		if (!unsealKey) return;

		const res = await fetch(`${this.addr}/v1/sys/health`, {
			method: "GET",
			headers: this.baseHeaders(),
		});

		if (res.status !== 503) return; // not sealed

		infoLogs("Vault is sealed, attempting auto-unseal...", LogTypes.LOGS, "Vault");

		const unsealRes = await fetch(`${this.addr}/v1/sys/unseal`, {
			method: "PUT",
			headers: this.baseHeaders(),
			body: JSON.stringify({ key: unsealKey }),
		});

		if (!unsealRes.ok) {
			const body = await unsealRes.text();
			throw new Error(`Vault auto-unseal failed (${unsealRes.status}): ${body}`);
		}

		infoLogs("Vault auto-unsealed successfully", LogTypes.LOGS, "Vault");
	}

	private async authenticate(): Promise<void> {
		const res = await fetch(`${this.addr}/v1/auth/approle/login`, {
			method: "POST",
			headers: this.baseHeaders(),
			body: JSON.stringify({
				role_id: this.roleId,
				secret_id: this.secretId,
			}),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vault AppRole auth failed (${res.status}): ${body}`);
		}

		const json = (await res.json()) as {
			auth: { client_token: string; lease_duration: number };
		};

		this.token = json.auth.client_token;
		this.scheduleRenewal(json.auth.lease_duration);
	}

	private scheduleRenewal(leaseDurationSec: number): void {
		if (this.renewalTimer) {
			clearInterval(this.renewalTimer);
		}

		// Renew at 75% of lease duration
		const renewalInterval = Math.max((leaseDurationSec * 0.75) * 1000, 10_000);

		this.renewalTimer = setInterval(async () => {
			try {
				await this.renewToken();
			} catch (err) {
				infoLogs(`Vault token renewal failed, re-authenticating: ${err}`, LogTypes.ERROR, "Vault");
				try {
					await this.authenticate();
				} catch (authErr) {
					infoLogs(`Vault re-authentication failed: ${authErr}`, LogTypes.ERROR, "Vault");
				}
			}
		}, renewalInterval);
	}

	private async renewToken(): Promise<void> {
		const res = await fetch(`${this.addr}/v1/auth/token/renew-self`, {
			method: "POST",
			headers: this.authHeaders(),
		});

		if (!res.ok) {
			throw new Error(`Vault token renewal failed (${res.status})`);
		}

		const json = (await res.json()) as {
			auth: { client_token: string; lease_duration: number };
		};

		this.token = json.auth.client_token;
	}

	private baseHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};
		if (this.namespace) {
			headers["X-Vault-Namespace"] = this.namespace;
		}
		return headers;
	}

	private authHeaders(): Record<string, string> {
		return {
			...this.baseHeaders(),
			"X-Vault-Token": this.token,
		};
	}

	/**
	 * Fetch wrapper that auto-reauthenticates on 403 (stale/revoked token)
	 * or 503 (Vault sealed then unsealed, old token invalid) and retries once.
	 */
	private async vaultFetch(url: string, init: RequestInit): Promise<Response> {
		const doFetch = () =>
			fetch(url, {
				...init,
				headers: {
					...this.authHeaders(),
					...((init.headers as Record<string, string>) || {}),
				},
			});

		const res = await doFetch();
		if (res.status === 403 || res.status === 503) {
			infoLogs(`Vault returned ${res.status}, re-authenticating and retrying...`, LogTypes.LOGS, "Vault");
			if (res.status === 503) {
				await this.tryUnseal();
			}
			await this.authenticate();
			return doFetch();
		}
		return res;
	}

	/**
	 * Read a secret from KV v2.
	 * Returns null if the path does not exist.
	 */
	async kvRead(path: string): Promise<VaultKVReadResult | null> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		const res = await this.vaultFetch(`${this.addr}/v1/${mount}/data/${secretPath}`, {
			method: "GET",
		});

		if (res.status === 404) {
			return null;
		}

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vault kvRead failed (${res.status}): ${body}`);
		}

		const json = (await res.json()) as { data: VaultKVReadResult };
		return json.data;
	}

	/**
	 * Read a specific version of a secret from KV v2.
	 * Returns null if the path/version does not exist.
	 */
	async kvReadVersion(path: string, version: number): Promise<VaultKVReadResult | null> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		const res = await this.vaultFetch(`${this.addr}/v1/${mount}/data/${secretPath}?version=${version}`, {
			method: "GET",
		});

		if (res.status === 404) {
			return null;
		}

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vault kvReadVersion failed (${res.status}): ${body}`);
		}

		const json = (await res.json()) as { data: VaultKVReadResult };
		return json.data;
	}

	/**
	 * Write a secret to KV v2. Creates a new version.
	 * Returns the version number created.
	 */
	async kvWrite(path: string, data: Record<string, any>): Promise<{ version: number }> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		const res = await this.vaultFetch(`${this.addr}/v1/${mount}/data/${secretPath}`, {
			method: "POST",
			body: JSON.stringify({ data }),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vault kvWrite failed (${res.status}): ${body}`);
		}

		const json = (await res.json()) as {
			data: { version: number; created_time: string };
		};

		return { version: json.data.version };
	}

	/**
	 * Soft-delete the latest version of a secret (marks as deleted, recoverable).
	 */
	async kvDelete(path: string): Promise<void> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		const res = await this.vaultFetch(`${this.addr}/v1/${mount}/data/${secretPath}`, {
			method: "DELETE",
		});

		if (!res.ok && res.status !== 404) {
			const body = await res.text();
			throw new Error(`Vault kvDelete failed (${res.status}): ${body}`);
		}
	}

	/**
	 * Permanently delete all versions and metadata of a secret.
	 */
	async kvMetadataDelete(path: string): Promise<void> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		const res = await this.vaultFetch(`${this.addr}/v1/${mount}/metadata/${secretPath}`, {
			method: "DELETE",
		});

		if (!res.ok && res.status !== 404) {
			const body = await res.text();
			throw new Error(`Vault kvMetadataDelete failed (${res.status}): ${body}`);
		}
	}

	/**
	 * List keys at a KV v2 path.
	 * Returns an empty array if the path does not exist.
	 */
	async kvList(path: string): Promise<string[]> {
		const [mount, ...rest] = path.split("/");
		const secretPath = rest.join("/");

		// Bun's fetch does not support the custom LIST HTTP method.
		// Use GET with ?list=true which is Vault's supported alternative.
		const res = await this.vaultFetch(
			`${this.addr}/v1/${mount}/metadata/${secretPath}?list=true`,
			{ method: "GET" },
		);

		if (res.status === 404) {
			return [];
		}

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Vault kvList failed (${res.status}): ${body}`);
		}

		const json = (await res.json()) as {
			data: { keys: string[] };
		};

		// Vault LIST returns keys with trailing slash for directories; strip them
		return (json.data.keys || []).map(k => k.replace(/\/$/, ""));
	}

	/**
	 * Health check -- verify Vault is reachable and authenticated.
	 */
	async healthCheck(): Promise<boolean> {
		try {
			const res = await fetch(`${this.addr}/v1/sys/health`, {
				method: "GET",
				headers: this.authHeaders(),
			});
			const ok = res.ok || res.status === 429 || res.status === 472 || res.status === 473;
			if (ok) {
				infoLogs("Vault reachable", LogTypes.LOGS, "Vault");
			} else {
				infoLogs(`Vault health check returned ${res.status}`, LogTypes.ERROR, "Vault");
			}
			return ok;
		} catch (err) {
			infoLogs(`Vault unreachable: ${err}`, LogTypes.ERROR, "Vault");
			return false;
		}
	}
}
