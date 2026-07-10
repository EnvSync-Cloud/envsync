/**
 * Rotation engine interface.
 *
 * Each engine implements the credential lifecycle for a specific provider.
 * Engines never see plaintext credentials — they produce and revoke credentials,
 * and the caller (RotationService) handles encryption and storage.
 */
export interface RotationEngine {
	readonly engineType: string;

	/**
	 * Generate a new credential. Returns the credential material
	 * that will be stored as the new value of the variable.
	 */
	generateCredential(config: EngineConfig): Promise<CredentialResult>;

	/**
	 * Revoke a previously generated credential.
	 * Called after the dual-credential window expires.
	 */
	revokeCredential(config: EngineConfig, credential: string): Promise<void>;

	/**
	 * Validate that the engine config is complete and correct.
	 * Throws a descriptive error if invalid.
	 */
	validateConfig(config: EngineConfig): void;
}

export interface EngineConfig {
	/** Provider-specific connection/config, stored encrypted in rotation_policies. */
	readonly connectionConfig: Record<string, unknown>;
	/** The current credential value (encrypted) for context during rotation. */
	readonly currentCredential?: string;
}

export interface CredentialResult {
	/** The new credential value (plaintext — caller encrypts). */
	readonly credential: string;
	/** Provider-specific metadata about the generated credential. */
	readonly metadata?: Record<string, unknown>;
}
