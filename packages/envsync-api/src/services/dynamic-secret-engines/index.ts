import type { DynamicSecretEngineInterface } from "./base";
import { PostgresEngine } from "./postgres";
import { MySQLEngine } from "./mysql";
import { AwsIamEngine } from "./aws-iam";
import { AzureSpEngine } from "./azure-sp";

export type { DynamicSecretEngineInterface, CredentialResult } from "./base";
export { generatePassword, generateUsername, applyTemplate } from "./base";

const engines: Record<string, DynamicSecretEngineInterface> = {
	postgres: new PostgresEngine(),
	mysql: new MySQLEngine(),
	"aws-iam": new AwsIamEngine(),
	"azure-sp": new AzureSpEngine(),
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
