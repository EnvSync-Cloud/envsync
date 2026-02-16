/**
 * In-memory Vault KV v2 mock for tests.
 *
 * This must be registered via mock.module() in setup.ts BEFORE
 * any application code imports @/libs/vault/index.
 */
import { mock } from "bun:test";

import type { VaultKVReadResult } from "@/libs/vault/index";

interface VaultVersion {
	data: Record<string, any>;
	created_time: string;
	destroyed: boolean;
	deletion_time: string;
}

interface VaultEntry {
	versions: VaultVersion[];
}

/** In-memory store keyed by full path (e.g. "envsync/org_id/app_id/env/env_type_id/key") */
const store = new Map<string, VaultEntry>();

function nowISO(): string {
	return new Date().toISOString();
}

/** Get latest non-destroyed version or null */
function latestVersion(entry: VaultEntry): { version: number; data: VaultVersion } | null {
	for (let i = entry.versions.length - 1; i >= 0; i--) {
		if (!entry.versions[i].destroyed) {
			return { version: i + 1, data: entry.versions[i] };
		}
	}
	return null;
}

export const MockVaultClient = {
	async kvRead(path: string): Promise<VaultKVReadResult | null> {
		const entry = store.get(path);
		if (!entry) return null;
		const latest = latestVersion(entry);
		if (!latest) return null;

		return {
			data: latest.data.data,
			metadata: {
				version: latest.version,
				created_time: latest.data.created_time,
				deletion_time: latest.data.deletion_time,
				destroyed: latest.data.destroyed,
				custom_metadata: null,
			},
		};
	},

	async kvReadVersion(path: string, version: number): Promise<VaultKVReadResult | null> {
		const entry = store.get(path);
		if (!entry || version < 1 || version > entry.versions.length) return null;
		const v = entry.versions[version - 1];

		return {
			data: v.data,
			metadata: {
				version,
				created_time: v.created_time,
				deletion_time: v.deletion_time,
				destroyed: v.destroyed,
				custom_metadata: null,
			},
		};
	},

	async kvWrite(path: string, data: Record<string, any>): Promise<{ version: number }> {
		let entry = store.get(path);
		if (!entry) {
			entry = { versions: [] };
			store.set(path, entry);
		}
		entry.versions.push({
			data,
			created_time: nowISO(),
			destroyed: false,
			deletion_time: "",
		});
		return { version: entry.versions.length };
	},

	async kvDelete(path: string): Promise<void> {
		const entry = store.get(path);
		if (!entry) return;
		const latest = latestVersion(entry);
		if (latest) {
			entry.versions[latest.version - 1].destroyed = true;
			entry.versions[latest.version - 1].deletion_time = nowISO();
		}
	},

	async kvMetadataDelete(path: string): Promise<void> {
		store.delete(path);
	},

	async kvList(path: string): Promise<string[]> {
		const prefix = path.endsWith("/") ? path : path + "/";
		const keys: Set<string> = new Set();

		for (const key of store.keys()) {
			if (key.startsWith(prefix)) {
				const rest = key.slice(prefix.length);
				// Only direct children (no further slashes)
				const segment = rest.split("/")[0];
				if (segment) keys.add(segment);
			}
		}
		return Array.from(keys);
	},

	async healthCheck(): Promise<boolean> {
		return true;
	},
};

/** Reset all in-memory vault data between tests */
export function resetVault(): void {
	store.clear();
}

/** Register the mock — call this from setup.ts */
export function registerVaultMock(): void {
	mock.module("@/libs/vault/index", () => ({
		VaultClient: {
			getInstance: async () => MockVaultClient,
		},
		// Re-export the type-compatible interface
		MockVaultClient,
	}));
}
