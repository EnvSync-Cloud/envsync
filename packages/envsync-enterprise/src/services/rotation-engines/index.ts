import type { RotationEngine } from "./types";
import { PostgresEngine } from "./postgres.engine";
import { MySQLEngine } from "./mysql.engine";
import { AwsIamEngine } from "./aws-iam.engine";
import { AzureSpEngine } from "./azure-sp.engine";
import { GcpServiceAccountEngine } from "./gcp-service-account.engine";
import { CloudflarePagesEngine } from "./cloudflare-pages.engine";
import { SendGridEngine } from "./sendgrid.engine";
import { TwilioEngine } from "./twilio.engine";
import { AwsMysqlEngine } from "./aws-mysql.engine";
import { AwsPostgresEngine } from "./aws-postgres.engine";
import { GcpSqlServerEngine } from "./gcp-sqlserver.engine";
import { GcpMysqlEngine } from "./gcp-mysql.engine";
import { GcpPostgresEngine } from "./gcp-postgres.engine";
import { MongoDBEngine } from "./mongodb.engine";

const engines = new Map<string, RotationEngine>([
	["postgres", new PostgresEngine()],
	["mysql", new MySQLEngine()],
	["aws-iam", new AwsIamEngine()],
	["azure-sp", new AzureSpEngine()],
	["gcp-service-account", new GcpServiceAccountEngine()],
	["cloudflare-pages", new CloudflarePagesEngine()],
	["sendgrid", new SendGridEngine()],
	["twilio", new TwilioEngine()],
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
