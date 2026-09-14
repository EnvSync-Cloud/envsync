import { describe, expect, test } from "bun:test";

import { AzureSpEngine } from "./azure-sp.engine";
import { AwsMysqlEngine } from "./aws-mysql.engine";
import { CloudflarePagesEngine } from "./cloudflare-pages.engine";
import { GcpPostgresEngine } from "./gcp-postgres.engine";
import { GcpServiceAccountEngine } from "./gcp-service-account.engine";
import { getRotationEngine, listRotationEngineTypes } from "./index";
import { SendGridEngine } from "./sendgrid.engine";
import { TwilioEngine } from "./twilio.engine";
import { getEngine, listEngineTypes } from "../dynamic-secret-engines";
import { AwsIamEngine as DynamicAwsIamEngine } from "../dynamic-secret-engines/aws-iam";
import { AzureSpEngine as DynamicAzureSpEngine } from "../dynamic-secret-engines/azure-sp";

describe("rotation engine catalog", () => {
	test("exposes only implemented engines", () => {
		expect(listRotationEngineTypes().sort()).toEqual(["aws-iam", "mongodb", "mysql", "postgres"]);
		expect(() => getRotationEngine("sendgrid")).toThrow("Unknown rotation engine type");
		expect(() => getRotationEngine("azure-sp")).toThrow("Unknown rotation engine type");
		expect(() => getRotationEngine("aws-mysql")).toThrow("Unknown rotation engine type");
	});

	test("stub engines refuse to mint credentials", async () => {
		const config = { connectionConfig: {} };
		await expect(new SendGridEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new TwilioEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new AzureSpEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new GcpServiceAccountEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new CloudflarePagesEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new AwsMysqlEngine().generateCredential(config)).rejects.toThrow("not implemented");
		await expect(new GcpPostgresEngine().generateCredential(config)).rejects.toThrow("not implemented");
	});
});

describe("dynamic secret engine catalog", () => {
	test("exposes only postgres and mysql", () => {
		expect(listEngineTypes().sort()).toEqual(["mysql", "postgres"]);
		expect(() => getEngine("aws-iam")).toThrow("Unknown dynamic secret engine type");
		expect(() => getEngine("azure-sp")).toThrow("Unknown dynamic secret engine type");
	});

	test("stub engines refuse to mint credentials", async () => {
		await expect(new DynamicAwsIamEngine().generateCredentials({}, 60)).rejects.toThrow("not implemented");
		await expect(new DynamicAzureSpEngine().generateCredentials({}, 60)).rejects.toThrow("not implemented");
	});
});
