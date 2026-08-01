import { randomBytes } from "node:crypto";

/**
 * Result returned after generating dynamic credentials.
 */
export interface CredentialResult {
	username: string;
	password: string;
	/** Additional engine-specific fields (e.g. access_key_id, secret_access_key). */
	[key: string]: unknown;
}

/**
 * Template variables available in creation statements.
 */
export interface TemplateVars {
	name: string;
	password: string;
	expiration: string;
	database?: string;
}

/**
 * Base interface every dynamic-secret engine must implement.
 */
export interface DynamicSecretEngineInterface {
	readonly engineType: string;

	/**
	 * Validate the engine configuration.
	 * Throws a descriptive error when the config is invalid.
	 */
	validateConfig(config: Record<string, unknown>): void;

	/**
	 * Generate a new set of short-lived credentials.
	 */
	generateCredentials(config: Record<string, unknown>, ttlSeconds: number): Promise<CredentialResult>;

	/**
	 * Revoke previously generated credentials.
	 * Best-effort — engines should log but not throw on revocation failures.
	 */
	revokeCredentials(config: Record<string, unknown>, credentialData: Record<string, unknown>): Promise<void>;
}

/**
 * Generate a cryptographically random password suitable for database users.
 */
export function generatePassword(length = 32): string {
	// URL-safe base64 from random bytes
	return randomBytes(Math.ceil((length * 3) / 4))
		.toString("base64url")
		.slice(0, length);
}

/**
 * Generate a unique username with a prefix and short random suffix.
 */
export function generateUsername(prefix: string): string {
	const suffix = randomBytes(4).toString("hex");
	return `${prefix}_${suffix}`;
}

/**
 * Apply template substitution in creation statements.
 */
export function applyTemplate(template: string, vars: TemplateVars): string {
	return template
		.replace(/\{\{name\}\}/g, vars.name)
		.replace(/\{\{password\}\}/g, vars.password)
		.replace(/\{\{expiration\}\}/g, vars.expiration)
		.replace(/\{\{database\}\}/g, vars.database ?? "");
}
