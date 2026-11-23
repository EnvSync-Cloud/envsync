import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { POSTGRES_IMAGE, REDIS_IMAGE } from "./render";

/**
 * Fixture startup-order-60s-postgres-delay.
 * Postgres accepts connections 60 seconds after the container starts.
 * The API process is started once and must become healthy with no extra deploy
 * and no manual container restart.
 *
 * miniKMS is not started here. Its boot retry is the companion miniKMS PR.
 * This repo's CLI still waits for minikms:50051 via waitForTcpService.
 */
const DELAY_SECONDS = 60;
const PG_PASSWORD = "fixture-pg";
const SAML_SECRET = `fixture-saml-${"0".repeat(51)}`;
const S3_SECRET = "fixture-s3-secret";
const ATRIUM_MANAGEMENT_SECRET = "fixture-atrium-management";
const ATRIUM_WEB_SECRET = "fixture-atrium-web";
const ATRIUM_API_SECRET = "fixture-atrium-api";
const SECRETS = [PG_PASSWORD, SAML_SECRET, S3_SECRET, ATRIUM_MANAGEMENT_SECRET, ATRIUM_WEB_SECRET, ATRIUM_API_SECRET];
const OPENFGA_STORE_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OPENFGA_MODEL_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
const LOG_PATH = "/tmp/startup-order-60s-postgres-delay.log";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const apiDir = path.join(repoRoot, "packages/envsync-api");
const tlsDir = path.join(repoRoot, "docker/minikms");

function redact(text: string) {
	let out = text;
	for (const secret of SECRETS) {
		if (secret) out = out.split(secret).join("[redacted]");
	}
	return out.replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s]+@/gi, match => {
		const scheme = match.slice(0, match.indexOf("://") + 3);
		return `${scheme}[redacted]@`;
	});
}

function assertRedacted(text: string) {
	for (const secret of SECRETS) {
		if (secret && text.includes(secret)) {
			throw new Error("redacted fixture output still contains a fixture secret");
		}
	}
}

function safeText(text: string) {
	const cleaned = redact(text);
	assertRedacted(cleaned);
	return cleaned;
}

describe("startup order 60 second postgres delay", () => {
	test("fixture startup-order-60s-postgres-delay: API becomes ready without another deploy", async () => {
		expect(SAML_SECRET.length).toBe(64);
		expect(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(OPENFGA_STORE_ID)).toBe(true);
		expect(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(OPENFGA_MODEL_ID)).toBe(true);

		const dockerInfo = spawnSync("docker", ["info"], { encoding: "utf8" });
		if (dockerInfo.status !== 0) {
			throw new Error(`docker is not available: ${safeText(dockerInfo.stderr || dockerInfo.stdout || "docker info failed").slice(-500)}`);
		}

		const id = `envsync-ac5-${process.pid}-${Date.now().toString(36)}`;
		const network = id;
		const pgName = `${id}-pg`;
		const redisName = `${id}-redis`;
		const runArgv: string[][] = [];
		const operatorDeployRetries = 0;
		let child: ChildProcess | undefined;
		let apiLog = "";
		let fga: ReturnType<typeof Bun.serve> | undefined;
		let envDir = "";
		const created = { network: false, pg: false, redis: false };

		const record = (args: string[]) => {
			runArgv.push(args);
			const command = args[0];
			if (command === "stack" || command === "service" || command === "restart" || command === "start") {
				throw new Error(`fixture issued a forbidden docker command: docker ${command}`);
			}
		};

		const docker = (args: string[]) => {
			record(args);
			const result = spawnSync("docker", args, { encoding: "utf8" });
			if (result.status !== 0) {
				throw new Error(`docker ${args[0]} failed: ${safeText(`${result.stderr || ""}\n${result.stdout || ""}`).slice(-800)}`);
			}
			return result.stdout;
		};

		const stopChild = () => {
			if (!child?.pid || child.exitCode !== null) return;
			try {
				process.kill(-child.pid, "SIGTERM");
			} catch {
				try {
					child.kill("SIGTERM");
				} catch {
					// The API process already exited.
				}
			}
		};

		try {
			fga = Bun.serve({
				hostname: "127.0.0.1",
				port: 0,
				fetch() {
					return Response.json({
						authorization_models: [{
							id: OPENFGA_MODEL_ID,
							schema_version: "1.1",
							type_definitions: [],
						}],
						continuation_token: "",
					});
				},
			});

			docker(["network", "create", network]);
			created.network = true;
			docker(["run", "-d", "--name", redisName, "--network", network, "-p", "127.0.0.1::6379", REDIS_IMAGE]);
			created.redis = true;

			envDir = mkdtempSync(path.join(os.tmpdir(), "envsync-ac5-"));
			const pgEnvFile = path.join(envDir, "pg.env");
			writeFileSync(pgEnvFile, `POSTGRES_USER=postgres\nPOSTGRES_PASSWORD=${PG_PASSWORD}\nPOSTGRES_DB=envsync\n`, { mode: 0o600 });
			const delayScript = [
				"export PATH=\"/usr/lib/postgresql/17/bin:$PATH\"",
				"echo FIXTURE_POSTGRES_DELAY_SECONDS=60",
				"echo FIXTURE_POSTGRES_DELAY_START",
				"sleep 60",
				"echo FIXTURE_POSTGRES_DELAY_DONE",
				"exec docker-entrypoint.sh postgres",
			].join("; ");
			docker([
				"run", "-d", "--name", pgName, "--network", network,
				"--env-file", pgEnvFile,
				"--entrypoint", "/bin/bash",
				"-p", "127.0.0.1::5432",
				POSTGRES_IMAGE,
				"-c", delayScript,
			]);
			created.pg = true;

			const pgPort = publishedPort(docker(["port", pgName, "5432"]));
			const redisPort = publishedPort(docker(["port", redisName, "6379"]));
			const apiPort = await freePort();
			const apiStarted = Date.now();
			child = spawn("bun", ["src/entrypoint.ts"], {
				cwd: apiDir,
				detached: true,
				env: apiEnv({
					port: apiPort,
					pgPort,
					redisPort,
					openfgaUrl: `http://127.0.0.1:${fga.port}`,
				}),
				stdio: ["ignore", "pipe", "pipe"],
			});
			child.stdout?.on("data", chunk => {
				apiLog += chunk.toString();
			});
			child.stderr?.on("data", chunk => {
				apiLog += chunk.toString();
			});

			const deadline = apiStarted + 170_000;
			let sawUnavailableDuringDelay = false;
			let healthyAt: number | undefined;
			const samples: string[] = [];
			while (Date.now() < deadline) {
				if (child.exitCode !== null) break;
				const probe = await probeHealth(apiPort);
				samples.push(`t=${Date.now() - apiStarted} status=${probe.status} body=${safeText(probe.body).slice(0, 180)}`);
				if (probe.status === 200 && probe.body.includes("ok!")) {
					healthyAt = Date.now();
					break;
				}
				if (probe.status === 503 && !probe.body.includes("ok") && !sawUnavailableDuringDelay) {
					const midLogs = spawnSync("docker", ["logs", pgName], { encoding: "utf8" });
					record(["logs", pgName]);
					const combined = `${midLogs.stdout || ""}\n${midLogs.stderr || ""}`;
					if (!combined.includes("FIXTURE_POSTGRES_DELAY_DONE")) {
						sawUnavailableDuringDelay = true;
					}
				}
				await new Promise(resolve => setTimeout(resolve, 2_000));
			}

			const pgLogs = spawnSync("docker", ["logs", pgName], { encoding: "utf8" });
			record(["logs", pgName]);
			const pgLogText = `${pgLogs.stdout || ""}\n${pgLogs.stderr || ""}`;
			const elapsed = healthyAt === undefined ? undefined : healthyAt - apiStarted;
			const proof = safeText([
				"fixture startup-order-60s-postgres-delay",
				"miniKMS image was not started. miniKMS boot retry is covered by the companion miniKMS PR plus the CLI TCP wait on minikms:50051.",
				`operatorDeployRetries=${operatorDeployRetries}`,
				`apiExitCode=${child.exitCode ?? "null"}`,
				`healthyElapsedMs=${elapsed ?? "none"}`,
				`sawUnavailableDuringDelay=${sawUnavailableDuringDelay}`,
				"docker argv during the run:",
				...runArgv.map(args => `docker ${args.map(arg => arg.includes(PG_PASSWORD) ? "[redacted]" : arg).join(" ")}`),
				"postgres logs:",
				pgLogText,
				"api log:",
				apiLog,
				"health samples:",
				...samples,
			].join("\n"));
			writeFileSync(LOG_PATH, proof);

			expect(child.exitCode).toBeNull();
			expect(sawUnavailableDuringDelay).toBe(true);
			expect(elapsed).toBeDefined();
			expect(elapsed ?? 0).toBeGreaterThanOrEqual(55_000);
			expect(elapsed ?? 0).toBeLessThan(60_000 + 120_000);
			const safePgLog = safeText(pgLogText);
			expect(safePgLog).toContain("FIXTURE_POSTGRES_DELAY_SECONDS=60");
			expect(safePgLog).toContain("FIXTURE_POSTGRES_DELAY_START");
			expect(safePgLog).toContain("FIXTURE_POSTGRES_DELAY_DONE");
			const safeApiLog = safeText(apiLog);
			expect(safeApiLog).toContain("Postgres not ready");
			expect(safeApiLog).toContain("API dependencies are ready");
			expect(operatorDeployRetries).toBe(0);
			expect(runArgv.some(args => args[0] === "stack" || args[0] === "service" || args[0] === "restart" || args[0] === "start")).toBe(false);
		} finally {
			stopChild();
			if (child?.pid && child.exitCode === null) {
				await new Promise(resolve => setTimeout(resolve, 500));
				if (child.exitCode === null) {
					try {
						process.kill(-child.pid, "SIGKILL");
					} catch {
						try {
							child.kill("SIGKILL");
						} catch {
							// Already gone.
						}
					}
				}
			}
			fga?.stop(true);
			if (created.pg) spawnSync("docker", ["rm", "-f", pgName], { stdio: "ignore" });
			if (created.redis) spawnSync("docker", ["rm", "-f", redisName], { stdio: "ignore" });
			if (created.network) spawnSync("docker", ["network", "rm", network], { stdio: "ignore" });
			if (envDir) rmSync(envDir, { recursive: true, force: true });
		}
	}, 300_000);
});

function publishedPort(output: string) {
	const line = output.split(/\r?\n/).find(entry => entry.includes("127.0.0.1:")) ?? output.trim();
	const match = line.match(/:(\d+)\s*$/);
	if (!match?.[1]) {
		throw new Error("docker did not publish a host port");
	}
	return match[1];
}

function freePort() {
	return new Promise<number>((resolve, reject) => {
		const server = net.createServer();
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			const port = typeof address === "object" && address ? address.port : 0;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

async function probeHealth(port: number) {
	try {
		const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2_000) });
		return { status: response.status, body: await response.text() };
	} catch (err) {
		return { status: 0, body: err instanceof Error ? err.message : "fetch failed" };
	}
}

function apiEnv(input: { port: number; pgPort: string; redisPort: string; openfgaUrl: string }) {
	const base = `http://127.0.0.1:${input.port}`;
	return {
		PATH: process.env.PATH ?? "",
		HOME: process.env.HOME ?? "",
		TMPDIR: process.env.TMPDIR ?? "/tmp",
		SKIP_ROOT_ENV: "1",
		SKIP_ROOT_ENV_WRITE: "1",
		NODE_ENV: "production",
		CACHE_ENV: "production",
		PORT: String(input.port),
		DB_AUTO_MIGRATE: "false",
		DB_LOGGING: "false",
		DATABASE_SSL: "false",
		DATABASE_HOST: "127.0.0.1",
		DATABASE_PORT: input.pgPort,
		DATABASE_USER: "postgres",
		DATABASE_PASSWORD: PG_PASSWORD,
		DATABASE_NAME: "envsync",
		REDIS_URL: `redis://127.0.0.1:${input.redisPort}`,
		S3_BUCKET: "fixture-bucket",
		S3_REGION: "us-east-1",
		S3_ACCESS_KEY: "fixture-s3-access",
		S3_SECRET_KEY: S3_SECRET,
		S3_BUCKET_URL: "http://127.0.0.1:9000",
		S3_ENDPOINT: "http://127.0.0.1:9000",
		SMTP_HOST: "127.0.0.1",
		SMTP_PORT: "1025",
		SMTP_FROM: "fixture@example.com",
		ATRIUM_INTERNAL_URL: "http://127.0.0.1:8080",
		ATRIUM_PUBLIC_URL: "http://127.0.0.1:8080",
		ATRIUM_ISSUER: "http://127.0.0.1:8080",
		ATRIUM_MANAGEMENT_CLIENT_ID: "management",
		ATRIUM_MANAGEMENT_CLIENT_SECRET: ATRIUM_MANAGEMENT_SECRET,
		ATRIUM_WEB_CLIENT_ID: "envsync-web",
		ATRIUM_WEB_CLIENT_SECRET: ATRIUM_WEB_SECRET,
		ATRIUM_CLI_CLIENT_ID: "envsync-cli",
		ATRIUM_API_CLIENT_ID: "envsync-api",
		ATRIUM_API_CLIENT_SECRET: ATRIUM_API_SECRET,
		ATRIUM_WEB_REDIRECT_URI: `${base}/callback`,
		ATRIUM_WEB_CALLBACK_URL: `${base}/callback`,
		ATRIUM_API_REDIRECT_URI: `${base}/callback`,
		LANDING_PAGE_URL: base,
		DASHBOARD_URL: base,
		API_URL: base,
		ENVSYNC_EDITION: "oss",
		ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
		ENVSYNC_MANAGEMENT_ENABLED: "false",
		ENVSYNC_LICENSE_ENFORCEMENT: "false",
		ENVSYNC_OBSERVABILITY_ENABLED: "false",
		OPENFGA_API_URL: input.openfgaUrl,
		OPENFGA_STORE_ID,
		OPENFGA_MODEL_ID,
		OTEL_SDK_DISABLED: "true",
		SAML_SESSION_SECRET: SAML_SECRET,
		MINIKMS_GRPC_ADDR: "127.0.0.1:50051",
		MINIKMS_TLS_ENABLED: "true",
		MINIKMS_TLS_CA_CERT_FILE: path.join(tlsDir, "grpc-ca-cert.dev.pem"),
		MINIKMS_TLS_CLIENT_CERT_FILE: path.join(tlsDir, "grpc-client-cert.dev.pem"),
		MINIKMS_TLS_CLIENT_KEY_FILE: path.join(tlsDir, "grpc-client-key.dev.pem"),
	};
}
