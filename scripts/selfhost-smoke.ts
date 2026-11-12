#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const rootDir = path.resolve(import.meta.dir, "..");
const smokeRoot = path.join(rootDir, ".tmp", "selfhost-smoke");
const runId = Date.now().toString(36);
const stackName = `envsync-smoke-${runId}`;
const tmpRoot = path.join(smokeRoot, stackName);
const hostRoot = path.join(tmpRoot, "opt");
const etcRoot = path.join(tmpRoot, "etc");
const traefikStateRoot = path.join(tmpRoot, "var", "lib", "envsync", "traefik");
const deployRoot = path.join(hostRoot, "deploy");
const releasesRoot = path.join(hostRoot, "releases");
const deployEnvPath = path.join(etcRoot, "deploy.env");
const deployYamlPath = path.join(etcRoot, "deploy.yaml");
const internalConfigPath = path.join(deployRoot, "config.json");
const traefikDynamicPath = path.join(deployRoot, "traefik-dynamic.yaml");
const stackPath = path.join(deployRoot, "docker-stack.yaml");
const keepFailed = process.argv.includes("--keep-failed");
const version = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8")).version as string;
const rootDomain = "127.0.0.1.sslip.io";
const enterpriseLicenseServerUrl = "https://license.envsync.cloud";
const localApiImage = `envsync-selfhost-smoke-api:${runId}`;
const localApiImageCanary = `envsync-selfhost-smoke-api:${runId}-canary`;
const localWebImage = `envsync-selfhost-smoke-web-static:${runId}`;
const localLandingImage = `envsync-selfhost-smoke-landing-static:${runId}`;
let publicHttpPort = 18080;
let publicHttpsPort = 18443;
const managedVolumes = [
	"postgres_data",
	"redis_data",
	"rustfs_data",
	"atrium_db_data",
	"openfga_db_data",
	"minikms_db_data",
	"clickstack_data",
	"clickstack_ch_data",
	"clickstack_ch_logs",
];

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

function tryRun(cmd: string, args: string[], options: { stdio?: "inherit" | "pipe"; env?: Record<string, string> } = {}) {
	const result = spawnSync(cmd, args, {
		cwd: rootDir,
		stdio: options.stdio ?? "pipe",
		encoding: "utf8",
		env: { ...process.env, ...options.env },
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout?.trim() ?? "",
		stderr: result.stderr?.trim() ?? "",
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
			server.close(error => {
				if (error) {
					reject(error);
					return;
				}
				resolve(port);
			});
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

function publicHttpsUrl(host: string, pathName = "") {
	return `https://${host}${publicHttpsPort === 443 ? "" : `:${publicHttpsPort}`}${pathName}`;
}

function writeConfig() {
	const enterpriseLicenseKey = process.env.ENVSYNC_E2E_LICENSE_KEY ?? process.env.ENVSYNC_LICENSE_KEY;
	if (!enterpriseLicenseKey) {
		throw new Error(
			"Enterprise self-host smoke requires ENVSYNC_E2E_LICENSE_KEY or ENVSYNC_LICENSE_KEY. In GitHub Actions, set ENVSYNC_E2E_LICENSE_KEY from secrets.",
		);
	}
	ensureDir(etcRoot);
	ensureDir(traefikStateRoot);
	ensureDir(path.join(hostRoot, "backups"));
	ensureDir(path.join(releasesRoot, "web", "current"));
	ensureDir(path.join(releasesRoot, "landing", "current"));
	const config = {
		source: {
			repo_url: "https://github.com/EnvSync-Cloud/envsync.git",
			ref: `v${version}`,
		},
		release: {
			version,
		},
		domain: {
			root_domain: rootDomain,
			acme_email: "smoke@127.0.0.1.sslip.io",
		},
		images: {
			api: localApiImage,
			atrium: "ghcr.io/bravo68web/atrium:0.2.0-rc.6",
			web: localWebImage,
			landing: localLandingImage,
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
			admin_password: "envsync-smoke-admin",
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
		license: {
			server_url: enterpriseLicenseServerUrl,
			key: enterpriseLicenseKey,
			certificate_validity_days: 30,
		},
	};
	fs.writeFileSync(deployYamlPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

function ensureSwarmManager() {
	const state = tryRun("docker", ["info", "--format", "{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}"]);
	const current = state.stdout.trim();
	if (current === "active|true") return;
	if (!current || current === "inactive|false") {
		run("docker", ["swarm", "init"]);
		return;
	}
	throw new Error(`Docker Swarm manager is required for selfhost smoke. Current state: ${current || "unknown"}`);
}

function runCli(args: string[], capture = false) {
	return run("bun", ["run", "packages/deploy-cli/src/index.ts", ...args], {
		stdio: capture ? "pipe" : "inherit",
		env: envForSmoke(),
	});
}

function buildLocalReleaseImages() {
	console.log("Building local self-host smoke images\n");
	run("docker", ["build", "-t", localApiImage, "packages/envsync-api"]);
	run("docker", ["tag", localApiImage, localApiImageCanary]);
	run("bun", ["run", "--filter", "@envsync-cloud/envsync-ts-sdk", "build"]);
	run("bun", ["run", "--filter", "envsync-web", "build"], {
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
	run("bun", ["run", "--filter", "envsync-landing", "build"], {
		env: {
			VITE_API_BASE_URL: "https://placeholder.invalid",
			VITE_HYPERDX_DISABLED: "true",
		},
	});
	run("docker", [
		"build",
		"-t",
		localLandingImage,
		"-f",
		"docker/frontend-static.Dockerfile",
		"apps/envsync-landing",
	]);
}

function readJson<T>(filePath: string): T {
	return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function writeJson(filePath: string, value: unknown) {
	fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function readRuntimeConfig(filePath: string) {
	const source = fs.readFileSync(filePath, "utf8").trim();
	const prefix = "window.__ENVSYNC_RUNTIME_CONFIG__ = ";
	if (!source.startsWith(prefix) || !source.endsWith(";")) {
		throw new Error(`Unexpected runtime-config format in ${filePath}`);
	}
	return JSON.parse(source.slice(prefix.length, -1)) as {
		otelEndpoint?: string;
		hyperdxApiKey?: string;
		hyperdxUrl?: string;
		hyperdxDisabled?: boolean;
	};
}

function curl(args: string[]) {
	return run("curl", args, { stdio: "pipe" });
}

function updateDeployConfig(mutator: (config: Record<string, unknown>) => void) {
	const config = readJson<Record<string, unknown>>(deployYamlPath);
	mutator(config);
	writeJson(deployYamlPath, config);
}

function sleep(seconds: number) {
  spawnSync("sleep", [String(seconds)], { stdio: "ignore" });
}

function assert(condition: unknown, message: string) {
	if (!condition) {
		throw new Error(message);
	}
}

function assertBootstrapArtifacts(expectedOtelEndpoint: string) {
	const deployEnv = fs.readFileSync(deployEnvPath, "utf8");
	const internal = readJson<{
		generated: {
			openfga: { store_id: string; model_id: string };
			deployment: {
				active_slot: "blue" | "green";
				previous_slot: "" | "blue" | "green";
				slots: Record<"blue" | "green", { api_image: string; release_version: string; deployed_at: string }>;
			};
			bootstrap: { completed_at: string };
		};
	}>(internalConfigPath);
	const traefikDynamic = fs.readFileSync(traefikDynamicPath, "utf8");
	const stackFile = fs.readFileSync(stackPath, "utf8");
	const webRuntime = readRuntimeConfig(path.join(releasesRoot, "web", "current", "runtime-config.js"));
	const landingRuntime = readRuntimeConfig(path.join(releasesRoot, "landing", "current", "runtime-config.js"));
	assert(/OPENFGA_STORE_ID=.+/.test(deployEnv), "deploy.env is missing OPENFGA_STORE_ID");
	assert(/OPENFGA_MODEL_ID=.+/.test(deployEnv), "deploy.env is missing OPENFGA_MODEL_ID");
	assert(internal.generated.openfga.store_id.length > 0, "config.json is missing generated OpenFGA store_id");
	assert(internal.generated.openfga.model_id.length > 0, "config.json is missing generated OpenFGA model_id");
	assert(internal.generated.deployment.active_slot === "blue", "first deploy should default the active API slot to blue");
	assert(internal.generated.deployment.slots.blue.api_image.length > 0, "blue slot image was not persisted");
	assert(internal.generated.bootstrap.completed_at.length > 0, "bootstrap completion timestamp was not persisted");
	assert(traefikDynamic.includes("obs-ui-router"), "traefik-dynamic.yaml is missing obs-ui-router");
	assert(traefikDynamic.includes("obs-api-router"), "traefik-dynamic.yaml is missing obs-api-router");
	assert(traefikDynamic.includes("obs-otlp-router"), "traefik-dynamic.yaml is missing obs-otlp-router");
	assert(stackFile.includes(`${stackName}-s3-router`), "stack file is missing explicit S3 router name");
	assert(stackFile.includes(`${stackName}-s3-console-router`), "stack file is missing explicit S3 console router name");
	assert(webRuntime.otelEndpoint === expectedOtelEndpoint, "web runtime-config has the wrong OTel endpoint");
	assert(landingRuntime.otelEndpoint === expectedOtelEndpoint, "landing runtime-config has the wrong OTel endpoint");
	assert(webRuntime.hyperdxUrl === expectedOtelEndpoint, "web runtime-config is missing HyperDX URL");
	assert(landingRuntime.hyperdxUrl === expectedOtelEndpoint, "landing runtime-config is missing HyperDX URL");
	assert(Boolean(webRuntime.hyperdxApiKey), "web runtime-config is missing HyperDX API key");
	assert(Boolean(landingRuntime.hyperdxApiKey), "landing runtime-config is missing HyperDX API key");
	assert(webRuntime.hyperdxDisabled === false, "web runtime-config unexpectedly disables HyperDX");
	assert(landingRuntime.hyperdxDisabled === false, "landing runtime-config unexpectedly disables HyperDX");
}

function assertObservabilityHealth() {
	const health = JSON.parse(runCli(["health", "--json"], true)) as {
		deploy?: {
			active_slot?: "blue" | "green";
			previous_slot?: null | "blue" | "green";
			api_slots?: Record<"blue" | "green", { active?: boolean; image?: string | null }>;
		};
		observability?: {
			browser_replay_runtime?: {
				web?: { configured?: boolean };
				landing?: { configured?: boolean };
			};
			sessions_source?: { configured?: boolean };
			saved_searches?: { configured?: boolean; missing?: string[] };
			tags?: { configured?: boolean; missing?: string[] };
		};
	};
	assert(health.observability?.browser_replay_runtime?.web?.configured, "health --json reports web replay runtime is not configured");
	assert(health.observability?.browser_replay_runtime?.landing?.configured, "health --json reports landing replay runtime is not configured");
	assert(health.observability?.sessions_source?.configured, "health --json reports Sessions source is not configured");
	assert(health.observability?.saved_searches?.configured, `health --json reports saved searches missing: ${(health.observability?.saved_searches?.missing ?? []).join(", ")}`);
	assert(health.observability?.tags?.configured, `health --json reports tags missing: ${(health.observability?.tags?.missing ?? []).join(", ")}`);
	assert(Boolean(health.deploy?.active_slot), "health --json did not report an active API slot");
}

function assertDeploymentSlots(expected: {
	active: "blue" | "green";
	previous: "" | "blue" | "green";
	activeImage: string;
	standbyImage?: string;
}) {
	const internal = readJson<{
		generated: {
			deployment: {
				active_slot: "blue" | "green";
				previous_slot: "" | "blue" | "green";
				slots: Record<"blue" | "green", { api_image: string; release_version: string; deployed_at: string }>;
			};
		};
	}>(internalConfigPath);
	const deployment = internal.generated.deployment;
	const standby = expected.active === "blue" ? "green" : "blue";
	assert(deployment.active_slot === expected.active, `expected active slot ${expected.active}, got ${deployment.active_slot}`);
	assert(deployment.previous_slot === expected.previous, `expected previous slot ${expected.previous || "<empty>"}, got ${deployment.previous_slot || "<empty>"}`);
	assert(deployment.slots[expected.active].api_image === expected.activeImage, `expected ${expected.active} slot image ${expected.activeImage}, got ${deployment.slots[expected.active].api_image}`);
	if (expected.standbyImage !== undefined) {
		assert(deployment.slots[standby].api_image === expected.standbyImage, `expected ${standby} slot image ${expected.standbyImage}, got ${deployment.slots[standby].api_image}`);
	}
}

function assertObsRouting() {
	const obsHost = `obs.${rootDomain}`;
	const obsBase = publicHttpsUrl(obsHost);
	const resolveArg = `${obsHost}:${publicHttpsPort}:127.0.0.1`;
	let apiConfig = "";
	let tracePreflight = "";
	let logPreflight = "";
	let lastError = "";
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		try {
			apiConfig = curl(["-ksS", "--resolve", resolveArg, "-D", "-", `${obsBase}/api/config`]);
			tracePreflight = curl([
				"-ksS",
				"--resolve",
				resolveArg,
				"-D",
				"-",
				"-X",
				"OPTIONS",
				`${obsBase}/v1/traces`,
				"-H",
				`Origin: ${publicHttpsUrl(rootDomain)}`,
				"-H",
				"Access-Control-Request-Method: POST",
				"-H",
				"Access-Control-Request-Headers: content-type",
			]);
			logPreflight = curl([
				"-ksS",
				"--resolve",
				resolveArg,
				"-D",
				"-",
				"-X",
				"OPTIONS",
				`${obsBase}/v1/logs`,
				"-H",
				`Origin: ${publicHttpsUrl(rootDomain)}`,
				"-H",
				"Access-Control-Request-Method: POST",
				"-H",
				"Access-Control-Request-Headers: authorization,content-encoding,content-type",
			]);
			if (
				(apiConfig.includes("HTTP/2 200") || apiConfig.includes("HTTP/1.1 200")) &&
				apiConfig.includes("collectorUrl") &&
				tracePreflight.includes(
					`access-control-allow-origin: ${publicHttpsUrl(rootDomain)}`,
				) &&
				tracePreflight.toLowerCase().includes("access-control-allow-credentials: true") &&
				logPreflight.includes(`access-control-allow-origin: ${publicHttpsUrl(rootDomain)}`) &&
				logPreflight.toLowerCase().includes("access-control-allow-credentials: true") &&
				logPreflight.toLowerCase().includes("content-encoding")
			) {
				break;
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
		sleep(2);
	}
	assert(apiConfig.includes("HTTP/2 200") || apiConfig.includes("HTTP/1.1 200"), "obs /api/config did not return 200");
	assert(apiConfig.includes("collectorUrl"), "obs /api/config did not return HyperDX config");
	assert(
		tracePreflight.includes(
			`access-control-allow-origin: ${publicHttpsUrl(rootDomain)}`,
		),
		lastError ? `obs OTLP preflight is missing access-control-allow-origin\n${lastError}` : "obs OTLP preflight is missing access-control-allow-origin",
	);
	assert(
		tracePreflight.toLowerCase().includes("access-control-allow-credentials: true"),
		"obs OTLP preflight is missing access-control-allow-credentials",
	);
	assert(
		logPreflight.includes(`access-control-allow-origin: ${publicHttpsUrl(rootDomain)}`),
		"obs log OTLP preflight is missing access-control-allow-origin",
	);
	assert(
		logPreflight.toLowerCase().includes("access-control-allow-credentials: true"),
		"obs log OTLP preflight is missing access-control-allow-credentials",
	);
	assert(
		logPreflight.toLowerCase().includes("content-encoding"),
		"obs log OTLP preflight is missing content-encoding in access-control-allow-headers",
	);
}

function assertApiAuthAndOtel() {
	const apiHost = `api.${rootDomain}`;
	const apiBase = publicHttpsUrl(apiHost);
	const resolveArg = `${apiHost}:${publicHttpsPort}:127.0.0.1`;
	let loginResponse = "";
	let lastError = "";
	const deadline = Date.now() + 60_000;
	while (Date.now() < deadline) {
		try {
			loginResponse = curl(["-ksS", "--resolve", resolveArg, `${apiBase}/api/access/web`]);
			if (
				loginResponse.includes(
					publicHttpsUrl(`auth.${rootDomain}`, "/realms/envsync/protocol/openid-connect/auth"),
				)
			) {
				break;
			}
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
		}
		sleep(2);
	}
	assert(
		loginResponse.includes(publicHttpsUrl(`auth.${rootDomain}`, "/realms/envsync/protocol/openid-connect/auth")),
		lastError ? `API web login URL did not use the public auth host\n${lastError}` : "API web login URL did not use the public auth host",
	);

	const otelReady = tryRun("docker", [
		"run",
		"--rm",
		"--network",
		`${stackName}_envsync`,
		"alpine:3.20",
		"sh",
		"-lc",
		"nc -z -w 2 otel-agent 4318",
	]);
	assert(otelReady.status === 0, "otel-agent was not reachable on port 4318 from the stack network");
}

function runDiagnostics() {
	console.error("\nSelf-host smoke diagnostics\n");
	const commands: Array<[string, string[]]> = [
		["docker", ["service", "ls"]],
		["docker", ["service", "ps", `${stackName}_traefik`, "--no-trunc"]],
		["docker", ["service", "ps", `${stackName}_clickstack`, "--no-trunc"]],
		["docker", ["service", "ps", `${stackName}_atrium`, "--no-trunc"]],
		["docker", ["service", "ps", `${stackName}_openfga`, "--no-trunc"]],
		["docker", ["ps", "--filter", `name=${stackName}`]],
		["docker", ["service", "logs", `${stackName}_traefik`, "--tail", "100"]],
		["docker", ["service", "logs", `${stackName}_clickstack`, "--tail", "100"]],
		["docker", ["service", "logs", `${stackName}_atrium`, "--tail", "100"]],
		["docker", ["service", "logs", `${stackName}_openfga`, "--tail", "100"]],
	];
	for (const [cmd, args] of commands) {
		console.error(`\n$ ${cmd} ${args.join(" ")}`);
		const result = tryRun(cmd, args);
		if (result.stdout) console.error(result.stdout);
		if (result.stderr) console.error(result.stderr);
	}
}

function cleanup() {
	const stackList = tryRun("docker", ["stack", "ls", "--format", "{{.Name}}"]);
	if (stackList.stdout.split(/\r?\n/).includes(stackName)) {
		tryRun("docker", ["stack", "rm", stackName]);
		const deadline = Date.now() + 60_000;
		while (Date.now() < deadline) {
			const remaining = tryRun("docker", ["stack", "ls", "--format", "{{.Name}}"]).stdout.split(/\r?\n/);
			if (!remaining.includes(stackName)) break;
			spawnSync("sleep", ["2"], { stdio: "ignore" });
		}
	}
	tryRun("docker", ["network", "rm", `${stackName}_envsync`]);
	for (const volume of managedVolumes) {
		tryRun("docker", ["volume", "rm", "-f", `${stackName}_${volume}`]);
	}
	removeDir(tmpRoot);
}

async function main() {
	console.log("Self-host smoke test\n");
	ensureSwarmManager();
	publicHttpPort = await reserveFreePort();
	publicHttpsPort = await reserveFreePort();
	buildLocalReleaseImages();
	writeConfig();

	let firstStoreId = "";
	try {
		runCli(["bootstrap", "--force"]);
		runCli(["deploy"]);
		const health = JSON.parse(runCli(["health", "--json"], true)) as {
			bootstrap: { completed: boolean };
		};
		assert(health.bootstrap.completed === true, "health --json did not report bootstrap completed");
		assertBootstrapArtifacts(publicHttpsUrl(`obs.${rootDomain}`));
		assertObservabilityHealth();
		assertObsRouting();
		assertApiAuthAndOtel();
		assertDeploymentSlots({
			active: "blue",
			previous: "",
			activeImage: localApiImage,
		});
		updateDeployConfig(config => {
			const images = (config.images ?? {}) as Record<string, unknown>;
			images.api = localApiImageCanary;
			config.images = images;
		});
		runCli(["deploy"]);
		assertDeploymentSlots({
			active: "green",
			previous: "blue",
			activeImage: localApiImageCanary,
			standbyImage: localApiImage,
		});
		assertApiAuthAndOtel();
		runCli(["rollback"]);
		assertDeploymentSlots({
			active: "blue",
			previous: "green",
			activeImage: localApiImage,
			standbyImage: localApiImageCanary,
		});
		assertApiAuthAndOtel();
		updateDeployConfig(config => {
			const images = (config.images ?? {}) as Record<string, unknown>;
			images.api = localApiImage;
			config.images = images;
		});
		firstStoreId = readJson<{ generated: { openfga: { store_id: string } } }>(internalConfigPath).generated.openfga.store_id;
		assert(firstStoreId.length > 0, "first bootstrap did not persist an OpenFGA store ID");
		runCli(["bootstrap", "--force"]);
		const secondStoreId = readJson<{ generated: { openfga: { store_id: string } } }>(internalConfigPath).generated.openfga.store_id;
		assert(secondStoreId.length > 0, "second bootstrap did not persist an OpenFGA store ID");
		assert(secondStoreId !== firstStoreId, "second destructive bootstrap reused the previous OpenFGA store ID");
		console.log("\nSelf-host smoke test passed");
	} catch (error) {
		runDiagnostics();
		throw error;
	} finally {
		if (!keepFailed) {
			cleanup();
		} else {
			console.log(`\nKeeping failed smoke state at ${tmpRoot}`);
		}
	}
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
