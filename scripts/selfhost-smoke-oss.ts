#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "..");
const smokeRoot = path.join(rootDir, ".tmp", "selfhost-smoke-oss");
const runId = Date.now().toString(36);
const stackName = `envsync-oss-smoke-${runId}`;
const tmpRoot = path.join(smokeRoot, stackName);
const hostRoot = path.join(tmpRoot, "opt");
const etcRoot = path.join(tmpRoot, "etc");
const traefikStateRoot = path.join(tmpRoot, "var", "lib", "envsync", "traefik");
const deployRoot = path.join(hostRoot, "deploy");
const releasesRoot = path.join(hostRoot, "releases");
const deployYamlPath = path.join(etcRoot, "deploy.yaml");
const traefikDynamicPath = path.join(deployRoot, "traefik-dynamic.yaml");
const stackPath = path.join(deployRoot, "docker-stack.yaml");
const version = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version as string;
const rootDomain = "127.0.0.1.sslip.io";
const localApiImage = `envsync-oss-smoke-api:${runId}`;
const localWebImage = `envsync-oss-smoke-web-static:${runId}`;
let publicHttpPort = 28080;
let publicHttpsPort = 28443;

function run(cmd: string, args: string[], options: { stdio?: "inherit" | "pipe"; env?: Record<string, string> } = {}) {
	const result = spawnSync(cmd, args, {
		cwd: rootDir,
		stdio: options.stdio ?? "inherit",
		encoding: "utf8",
		env: { ...process.env, ...options.env },
	});
	if (result.status !== 0) {
		const stderr = typeof result.stderr === "string" ? result.stderr : "";
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
	}
	return result.stdout?.trim() ?? "";
}

function tryRun(cmd: string, args: string[]) {
	const result = spawnSync(cmd, args, {
		cwd: rootDir,
		stdio: "pipe",
		encoding: "utf8",
		env: process.env,
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout?.trim() ?? "",
	};
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir: string) {
	fs.rmSync(dir, { recursive: true, force: true });
}

async function reserveFreePort() {
	return await new Promise<number>((resolve, reject) => {
		const server = net.createServer();
		server.unref();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address === "string") {
				server.close(() => reject(new Error("Could not resolve free TCP port")));
				return;
			}
			const { port } = address;
			server.close(error => (error ? reject(error) : resolve(port)));
		});
	});
}

function envForSmoke() {
	return {
		ENVSYNC_HOST_ROOT: hostRoot,
		ENVSYNC_ETC_ROOT: etcRoot,
		ENVSYNC_TRAEFIK_STATE_ROOT: traefikStateRoot,
		ENVSYNC_REPO_ROOT: rootDir,
	};
}

function runCli(args: string[], capture = false) {
	return run("bun", ["run", "packages/deploy/src/index.ts", ...args], {
		stdio: capture ? "pipe" : "inherit",
		env: envForSmoke(),
	});
}

function assert(condition: unknown, message: string) {
	if (!condition) {
		throw new Error(message);
	}
}

function ensureSwarmManager() {
	const state = tryRun("docker", ["info", "--format", "{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}"]);
	const current = state.stdout.trim();
	if (current === "active|true") return;
	if (!current || current === "inactive|false") {
		run("docker", ["swarm", "init"]);
		return;
	}
	throw new Error(`Docker Swarm manager is required for OSS smoke. Current state: ${current || "unknown"}`);
}

function buildLocalReleaseImages() {
	run("docker", ["build", "-t", localApiImage, "packages/envsync-api"]);
	run("bun", ["run", "--filter", "@envsync-cloud/envsync-ts-sdk", "build"]);
	run("bun", ["run", "--filter", "envsync-web", "build:oss"], {
		env: {
			VITE_API_BASE_URL: "https://placeholder.invalid",
			VITE_HYPERDX_DISABLED: "true",
		},
	});
	run("docker", [
		"build",
		"-t",
		localWebImage,
		"-f",
		"docker/frontend-static.Dockerfile",
		"apps/envsync-web",
	]);
}

function writeConfig() {
	ensureDir(etcRoot);
	ensureDir(traefikStateRoot);
	ensureDir(path.join(hostRoot, "backups"));
	ensureDir(path.join(releasesRoot, "web", "current"));
	const config = {
		edition: "oss",
		source: {
			repo_url: "https://github.com/EnvSync-Cloud/envsync.git",
			ref: `v${version}`,
		},
		release: {
			version,
		},
		domain: {
			root_domain: rootDomain,
			acme_email: "oss-smoke@127.0.0.1.sslip.io",
		},
		images: {
			api: localApiImage,
			atrium: "ghcr.io/bravo68web/atrium:0.2.0-rc.8",
			web: localWebImage,
			landing: `ghcr.io/envsync-cloud/envsync-landing-static:${version}`,
			clickstack: "clickhouse/clickstack-all-in-one:latest",
			traefik: "traefik:v3.6.6",
			otel_agent: "otel/opentelemetry-collector-contrib:0.111.0",
		},
		services: {
			stack_name: stackName,
			api_port: 4000,
			public_http_port: publicHttpPort,
			public_https_port: publicHttpsPort,
			clickstack_ui_port: 8080,
			clickstack_otlp_http_port: 4318,
			clickstack_otlp_grpc_port: 4317,
			atrium_port: 8080,
			rustfs_port: 9000,
			rustfs_console_port: 9001,
		},
		auth: {
			management_client_id: "management",
			admin_user: "admin",
			admin_password: "envsync-oss-smoke-admin",
			web_client_id: "envsync-web",
			api_client_id: "envsync-api",
			cli_client_id: "envsync-cli",
		},
		observability: {
			retention_days: 7,
			public_obs: true,
		},
		backup: {
			output_dir: path.join(hostRoot, "backups"),
			encrypted: true,
		},
		smtp: {
			host: "smtp.example.com",
			port: 587,
			secure: true,
			user: "",
			pass: "",
			from: "noreply@127.0.0.1.sslip.io",
		},
		exposure: {
			public_auth: true,
			public_obs: true,
			mailpit_enabled: false,
			s3_public: true,
			s3_console_public: true,
		},
		upgrade: {
			maintenance_mode_enabled: true,
			db_snapshot_on_api_upgrade: true,
			keep_failed_upgrade_db_snapshot: true,
		},
	};
	fs.writeFileSync(deployYamlPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function cleanup() {
	try {
		run("docker", ["stack", "rm", stackName], { stdio: "pipe" });
	} catch {
	}
	removeDir(tmpRoot);
}

async function main() {
	publicHttpPort = await reserveFreePort();
	publicHttpsPort = await reserveFreePort();
	removeDir(tmpRoot);
	ensureDir(tmpRoot);
	ensureSwarmManager();
	writeConfig();
	buildLocalReleaseImages();
	runCli(["bootstrap", "--force"]);
	runCli(["deploy"]);
	const health = JSON.parse(runCli(["health", "--json"], true)) as {
		deploy: { api: string; web: string; landing: string };
		public: Record<string, string>;
		frontend_runtime: {
			web: { api_base_url: string | null; release_version: string | null };
			landing: { api_base_url: string | null };
		};
	};
	const stackFile = fs.readFileSync(stackPath, "utf8");
	const traefikDynamic = fs.readFileSync(traefikDynamicPath, "utf8");

	assert(health.deploy.api === "healthy", "OSS smoke expected healthy API");
	assert(health.deploy.web === "healthy", "OSS smoke expected healthy web");
	assert(!("landing" in health.public), "OSS smoke should not publish a landing URL");
	assert(health.frontend_runtime.web.api_base_url !== null, "OSS smoke expected web runtime config");
	assert(health.frontend_runtime.web.release_version === version, "OSS smoke expected web release version");
	assert(health.frontend_runtime.landing.api_base_url === null, "OSS smoke should not activate landing runtime config");
	assert(!stackFile.includes("landing_nginx"), "OSS stack should not render landing nginx");
	assert(!stackFile.includes("nginx_landing_conf"), "OSS stack should not render landing nginx config");
	assert(!traefikDynamic.includes("landing-router"), "OSS traefik config should not render landing router");
	assert(!fs.existsSync(path.join(releasesRoot, "landing", "current", "runtime-config.js")), "OSS smoke should not write landing runtime config");
	assert(!stackFile.includes("management_api"), "OSS stack should not render management API service");
	assert(!stackFile.includes("envsync-management-api"), "OSS stack should not reference management API image");
	runCli(["backup"]);
}

main()
	.catch(error => {
		cleanup();
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	})
	.finally(() => {
		cleanup();
	});
