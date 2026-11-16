#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { authorizationModelDef } from "../packages/envsync-api/src/libs/openfga/model";
import {
	loadEnvFile,
	updateEnvFile,
	waitForPostgres,
	waitForOpenFGA,
	waitForAtrium,
	waitForMiniKMS,
	waitForMailpit,
} from "./lib/services";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function run(cmd: string, args: string[], cwd = rootDir) {
	const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
	if (result.status !== 0) throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
}

function composeArgs(file?: string) {
	return file ? ["compose", "-f", file] : ["compose"];
}

function ensureMiniKmsSchema(file?: string) {
	run("docker", [...composeArgs(file), "run", "--rm", "minikms_migrate"]);
	run("docker", [...composeArgs(file), "restart", "minikms"]);
}

function ensureEnv(example = ".env.example") {
	const target = path.join(rootDir, ".env");
	if (!fs.existsSync(target)) {
		fs.copyFileSync(path.join(rootDir, example), target);
	}
	loadEnvFile(target);
}

async function initOpenFGA() {
	const apiUrl = (process.env.OPENFGA_API_URL ?? "http://localhost:8090").replace(/\/$/, "");
	const storeRes = await fetch(`${apiUrl}/stores`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "envsync" }),
	});
	if (!storeRes.ok) throw new Error(`OpenFGA store create failed: ${await storeRes.text()}`);
	const store = (await storeRes.json()) as { id: string };
	const modelRes = await fetch(`${apiUrl}/stores/${store.id}/authorization-models`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(authorizationModelDef),
	});
	if (!modelRes.ok) throw new Error(`OpenFGA model write failed: ${await modelRes.text()}`);
	const model = (await modelRes.json()) as { authorization_model_id: string };
	updateEnvFile(path.join(rootDir, ".env"), {
		OPENFGA_STORE_ID: store.id,
		OPENFGA_MODEL_ID: model.authorization_model_id,
	});
}

async function initLocal() {
	ensureEnv();
	run("docker", ["compose", "up", "-d", "postgres", "redis", "rustfs", "mailpit", "atrium_db", "atrium", "atrium-seed", "openfga_db", "openfga_migrate", "openfga", "minikms_db", "minikms_migrate", "minikms", "clickstack", "otel-agent"]);
	await waitForPostgres();
	await waitForPostgres("localhost", parseInt(process.env.MINIKMS_DB_PORT ?? "5544", 10));
	await waitForOpenFGA();
	await waitForMailpit();
	await waitForAtrium();
	ensureMiniKmsSchema();
	await waitForMiniKMS();
	await initOpenFGA();
	run("bun", ["run", "packages/envsync-api/scripts/cli.ts", "init"]);
	run("bun", ["run", "scripts/migrate.ts", "latest"], path.join(rootDir, "packages/envsync-api"));
}

async function initProd() {
	ensureEnv(".env.prod.example");
	run("docker", ["compose", "-f", "docker-compose.prod.yaml", "up", "-d", "postgres", "redis", "rustfs", "atrium_db", "atrium", "atrium-seed", "openfga_db", "openfga_migrate", "openfga", "minikms_db", "minikms_migrate", "minikms", "clickstack", "otel-agent"]);
	await waitForPostgres("localhost", 5432);
	await waitForPostgres("localhost", parseInt(process.env.MINIKMS_DB_PORT ?? "5544", 10));
	await waitForOpenFGA("http://localhost:8090");
	await waitForAtrium("http://localhost:8080");
	ensureMiniKmsSchema("docker-compose.prod.yaml");
	await waitForMiniKMS("localhost", 50051);
	run("docker", ["compose", "-f", "docker-compose.prod.yaml", "run", "--rm", "envsync_init"]);
}

function runDb(args: string[]) {
	run("bun", ["run", "scripts/migrate.ts", ...args], path.join(rootDir, "packages/envsync-api"));
}

function servicesUp() {
	run("docker", ["compose", "up", "-d"]);
}

function servicesDown() {
	run("docker", ["compose", "down"]);
}

function servicesStatus() {
	run("docker", ["compose", "ps"]);
}

const cmd = process.argv[2];
if (cmd === "init" && process.argv.includes("--prod")) {
	await initProd();
} else if (cmd === "init") {
	await initLocal();
} else if (cmd === "db") {
	runDb(process.argv.slice(3));
} else if (cmd === "services") {
	const sub = process.argv[3];
	if (sub === "up") servicesUp();
	else if (sub === "down") servicesDown();
	else if (sub === "status") servicesStatus();
	else process.exit(1);
} else {
	console.log("Usage: bun run cli <init|init --prod|db|services>");
	process.exit(cmd ? 1 : 0);
}
