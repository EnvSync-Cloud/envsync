#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { OpenFgaClient } from "@openfga/sdk";
import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from "@aws-sdk/client-s3";

import { authorizationModelDef } from "../src/libs/openfga/model";
import { updateRootEnv } from "../src/utils/load-root-env";
import { config } from "../src/utils/env";

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const noWriteRootEnv = args.has("--no-write-root-env");
const skipMigrations = args.has("--skip-migrations");

function formatErrorMessage(error: unknown) {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function log(message: string) {
	if (jsonMode) {
		console.error(message);
		return;
	}
	console.log(message);
}

function buildPublicReadBucketPolicy(bucket: string) {
	return JSON.stringify({
		Version: "2012-10-17",
		Statement: [
			{
				Sid: "AllowPublicReadObjects",
				Effect: "Allow",
				Principal: "*",
				Action: ["s3:GetObject"],
				Resource: [`arn:aws:s3:::${bucket}/*`],
			},
		],
	});
}

function assertCompleteOpenFgaState() {
	if ((config.OPENFGA_STORE_ID && !config.OPENFGA_MODEL_ID) || (!config.OPENFGA_STORE_ID && config.OPENFGA_MODEL_ID)) {
		throw new Error("Partial OpenFGA bootstrap state detected. Set both OPENFGA_STORE_ID and OPENFGA_MODEL_ID, or neither.");
	}
}

async function initOpenFGA() {
	assertCompleteOpenFgaState();

	try {
		if (config.OPENFGA_STORE_ID && config.OPENFGA_MODEL_ID) {
			const existing = new OpenFgaClient({
				apiUrl: config.OPENFGA_API_URL,
				storeId: config.OPENFGA_STORE_ID,
				authorizationModelId: config.OPENFGA_MODEL_ID,
			});
			await existing.getStore();
			await existing.readAuthorizationModel({
				storeId: config.OPENFGA_STORE_ID,
				authorizationModelId: config.OPENFGA_MODEL_ID,
			});
			return {
				storeId: config.OPENFGA_STORE_ID,
				modelId: config.OPENFGA_MODEL_ID,
			};
		}

		const client = new OpenFgaClient({ apiUrl: config.OPENFGA_API_URL });
		const store = await client.createStore({ name: "envsync" });
		const model = await client.writeAuthorizationModel(authorizationModelDef, { storeId: store.id });

		if (!store.id || !model.authorization_model_id) {
			throw new Error("OpenFGA bootstrap failed to return store/model IDs");
		}

		if (!noWriteRootEnv) {
			updateRootEnv({
				OPENFGA_STORE_ID: store.id,
				OPENFGA_MODEL_ID: model.authorization_model_id,
			});
		}

		return {
			storeId: store.id,
			modelId: model.authorization_model_id,
		};
	} catch (error) {
		const message = formatErrorMessage(error);
		if (message.includes("status code 500") || message.includes("Internal Server Error")) {
			throw new Error(
				"OpenFGA is reachable but not initialized correctly. Verify the OpenFGA datastore migration completed successfully before running prod-init.",
			);
		}
		throw new Error(`OpenFGA bootstrap failed: ${message}`);
	}
}

async function initRustfs() {
	const client = new S3Client({
		region: config.S3_REGION,
		endpoint: config.S3_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.S3_ACCESS_KEY,
			secretAccessKey: config.S3_SECRET_KEY,
		},
	});
	try {
		await client.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET, ACL: "public-read" }));
	} catch {
	}

	await client.send(
		new PutBucketPolicyCommand({
			Bucket: config.S3_BUCKET,
			Policy: buildPublicReadBucketPolicy(config.S3_BUCKET),
		}),
	);
}

function runMigrations() {
	const result = spawnSync("bun", ["run", "scripts/migrate.ts", "latest"], {
		cwd: fileURLToPath(new URL("..", import.meta.url)),
		stdio: jsonMode ? "pipe" : "inherit",
		env: process.env,
		encoding: "utf8",
	});
	if (jsonMode) {
		if (result.stdout) {
			process.stderr.write(result.stdout);
		}
		if (result.stderr) {
			process.stderr.write(result.stderr);
		}
	}
	if (result.status !== 0) throw new Error("DB migrations failed");
}

async function main() {
	log("=== Atrium ===");
	log(`ATRIUM_INTERNAL_URL=${config.ATRIUM_INTERNAL_URL}`);
	log(`ATRIUM_ISSUER=${config.ATRIUM_ISSUER}`);
	log(`ATRIUM_WEB_CLIENT_ID=${config.ATRIUM_WEB_CLIENT_ID}`);
	log(`ATRIUM_API_CLIENT_ID=${config.ATRIUM_API_CLIENT_ID}`);
	log(`ATRIUM_CLI_CLIENT_ID=${config.ATRIUM_CLI_CLIENT_ID}`);

	log("\n=== OpenFGA ===");
	const openfga = await initOpenFGA();

	log("\n=== Database ===");
	if (skipMigrations) {
		log("Skipping DB migrations because --skip-migrations was provided");
	} else {
		runMigrations();
	}

	log("\n=== RustFS ===");
	await initRustfs();

	log("\n=== ClickStack ===");
	log("CLICKSTACK_URL=http://clickstack:8080");
	log("OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-agent:4318");

	if (jsonMode) {
		console.log(
			JSON.stringify({
				openfgaStoreId: openfga.storeId,
				openfgaModelId: openfga.modelId,
			}),
		);
		return;
	}

	console.log(`OPENFGA_STORE_ID=${openfga.storeId}`);
	console.log(`OPENFGA_MODEL_ID=${openfga.modelId}`);
}

await main().catch(error => {
	const message = formatErrorMessage(error);
	if (jsonMode) {
		console.error(message);
	} else {
		console.error(error instanceof Error ? error : message);
	}
	process.exit(1);
});
