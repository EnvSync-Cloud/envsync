import type { DynamicSecretEngineInterface } from "./base";
import { PostgresEngine } from "./postgres";
import { MySQLEngine } from "./mysql";

export type { DynamicSecretEngineInterface, CredentialResult } from "./base";
export { generatePassword, generateUsername, applyTemplate } from "./base";

// aws-iam / azure-sp mint random creds and are not registered.
const engines: Record<string, DynamicSecretEngineInterface> = {
	postgres: new PostgresEngine(),
	mysql: new MySQLEngine(),
};

/**
 * Resolve an engine instance by its type string.
 * Throws when the engine type is unknown.
 */
export function getEngine(engineType: string): DynamicSecretEngineInterface {
	const engine = engines[engineType];
	if (!engine) {
		throw new Error(`Unknown dynamic secret engine type: ${engineType}`);
	}
	return engine;
}

/**
 * Return all registered engine types.
 */
export function listEngineTypes(): string[] {
	return Object.keys(engines);
}
