import type { RotationEngine } from "./types";
import { PostgresEngine } from "./postgres.engine";
import { MySQLEngine } from "./mysql.engine";
import { AwsIamEngine } from "./aws-iam.engine";
import { AwsMysqlEngine } from "./aws-mysql.engine";
import { AwsPostgresEngine } from "./aws-postgres.engine";
import { GcpSqlServerEngine } from "./gcp-sqlserver.engine";
import { GcpMysqlEngine } from "./gcp-mysql.engine";
import { GcpPostgresEngine } from "./gcp-postgres.engine";
import { MongoDBEngine } from "./mongodb.engine";

// Stub engines that mint random credentials (sendgrid, twilio, azure-sp,
// gcp-service-account, cloudflare-pages) stay in tree but are not registered.
const engines = new Map<string, RotationEngine>([
	["postgres", new PostgresEngine()],
	["mysql", new MySQLEngine()],
	["aws-iam", new AwsIamEngine()],
	["aws-mysql", new AwsMysqlEngine()],
	["aws-postgres", new AwsPostgresEngine()],
	["gcp-sqlserver", new GcpSqlServerEngine()],
	["gcp-mysql", new GcpMysqlEngine()],
	["gcp-postgres", new GcpPostgresEngine()],
	["mongodb", new MongoDBEngine()],
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

export type { RotationEngine, EngineConfig, CredentialResult } from "./types";
