import type { RotationEngine } from "./types";
import { PostgresEngine } from "./postgres.engine";
import { MySQLEngine } from "./mysql.engine";
import { AwsIamEngine } from "./aws-iam.engine";
import { MongoDBEngine } from "./mongodb.engine";

// Catalog is only engines that talk to a real provider or database.
// sendgrid, twilio, azure-sp, gcp-service-account, cloudflare-pages,
// aws-mysql, aws-postgres, and gcp-* Cloud SQL stubs stay on disk but
// are not registered.
const engines = new Map<string, RotationEngine>([
	["postgres", new PostgresEngine()],
	["mysql", new MySQLEngine()],
	["mongodb", new MongoDBEngine()],
	["aws-iam", new AwsIamEngine()],
]);

/**
 * Get a rotation engine by type. Throws if the engine type is unknown.
 */
export function getRotationEngine(engineType: string): RotationEngine {
	const engine = engines.get(engineType);
	if (!engine) {
		throw new Error(`Unknown rotation engine type: ${engineType}`);
	}
	return engine;
}

export function listRotationEngineTypes(): string[] {
	return [...engines.keys()];
}

export type { RotationEngine, EngineConfig, CredentialResult } from "./types";
