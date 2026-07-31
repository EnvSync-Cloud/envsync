import { createHash, randomBytes, randomInt } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import chalk from "chalk";
import YAML from "yaml";
import { formatDeploymentPlan, loadDeploymentPlanFromFile } from "@envsync-cloud/deploy-core";
import * as renderHelpers from "./render";
import * as staticBundleHelpers from "./static-bundle";

interface DeployConfig {
	edition?: "oss" | "enterprise";
	source: {
		repo_url: string;
		ref: string;
	};
	release: {
		version: string;
	};
	domain: {
		root_domain: string;
		acme_email: string;
	};
	images: {
		api: string;
		management_api: string;
		keycloak: string;
		web: string;
		landing: string;
		clickstack: string;
		traefik: string;
		otel_agent: string;
	};
	services: {
		stack_name: string;
		api_port: number;
		management_api_port: number;
		public_http_port: number;
		public_https_port: number;
		clickstack_ui_port: number;
		clickstack_otlp_http_port: number;
		clickstack_otlp_grpc_port: number;
		keycloak_port: number;
		rustfs_port: number;
		rustfs_console_port: number;
	};
	auth: {
		keycloak_realm: string;
		admin_user: string;
		admin_password: string;
		web_client_id: string;
		api_client_id: string;
		cli_client_id: string;
	};
	observability: {
		retention_days: number;
		public_obs: boolean;
		alert_webhook_url?: string;
		alert_webhook_headers?: Record<string, string>;
	};
	backup: {
		output_dir: string;
		encrypted: boolean;
	};
	smtp: {
		host: string;
		port: number;
		secure: boolean;
		user: string;
		pass: string;
		from: string;
	};
	exposure: {
		public_auth: boolean;
		public_obs: boolean;
		mailpit_enabled: boolean;
		s3_public: boolean;
		s3_console_public: boolean;
	};
	upgrade: {
		maintenance_mode_enabled: boolean;
		db_snapshot_on_api_upgrade: boolean;
		keep_failed_upgrade_db_snapshot: boolean;
	};
	netutils?: {
		enabled?: boolean;
		forwards?: Array<{
			service: string;
			service_port: number;
			host_port: number;
			protocol?: "tcp" | "udp";
		}>;
	};
	vpn?: {
		provider: "netbird" | "none";
		internal_domain?: string;
		nb_setup_key?: string;
	};
	license?: {
		server_url?: string;
		key?: string;
		install_fingerprint?: string;
		certificate_bundle_file?: string;
		lease_ttl_seconds?: number;
		certificate_validity_days?: number;
	};
	release_channel?: string;
}

interface DeployGeneratedState {
	openfga: {
		store_id: string;
		model_id: string;
	};
	deployment: {
		active_slot: ApiSlot;
		previous_slot: "" | ApiSlot;
		maintenance_mode: boolean;
		slots: Record<ApiSlot, ApiSlotState>;
	};
	clickstack: {
		operator_email: string;
		operator_password: string;
		access_key: string;
		browser_api_key: string;
	};
	secrets: {
		s3_secret_key: string;
		keycloak_db_password: string;
		keycloak_web_client_secret: string;
		keycloak_api_client_secret: string;
		openfga_db_password: string;
		minikms_root_key: string;
		minikms_db_password: string;
	};
	bootstrap: {
		completed_at: string;
	};
}

interface InternalState {
	config: DeployConfig;
	generated: DeployGeneratedState;
}

type ApiSlot = "blue" | "green";
type ApiSlotState = {
	api_image: string;
	release_version: string;
	deployed_at: string;
};
type RuntimeEnv = Record<string, string>;
type ServiceHealth = "healthy" | "missing" | "degraded";
type CommandOptions = { dryRun: boolean; force: boolean };
type NetutilsForward = {
	service: string;
	service_port: number;
	host_port: number;
	protocol: "tcp" | "udp";
};
type NetutilsExposeAllSpec = {
	service: string;
	service_port: number;
	protocol: "tcp" | "udp";
};

const NETUTILS_EXPOSE_ALL_START_PORT = 15000;
const NETUTILS_EXPOSE_ALL_PORTS: readonly NetutilsExposeAllSpec[] = [
	{ service: "postgres", service_port: 5432, protocol: "tcp" },
	{ service: "envsync_api_blue", service_port: 4000, protocol: "tcp" },
	{ service: "envsync_api_green", service_port: 4000, protocol: "tcp" },
	{ service: "envsync-management-api", service_port: 4001, protocol: "tcp" },
	{ service: "keycloak", service_port: 8080, protocol: "tcp" },
	{ service: "openfga", service_port: 8090, protocol: "tcp" },
	{ service: "minikms", service_port: 50051, protocol: "tcp" },
	{ service: "keycloak_db", service_port: 5432, protocol: "tcp" },
	{ service: "openfga_db", service_port: 5432, protocol: "tcp" },
	{ service: "minikms_db", service_port: 5432, protocol: "tcp" },
	{ service: "redis", service_port: 6379, protocol: "tcp" },
	{ service: "rustfs", service_port: 9000, protocol: "tcp" },
	{ service: "rustfs", service_port: 9001, protocol: "tcp" },
	{ service: "clickstack", service_port: 8080, protocol: "tcp" },
	{ service: "otel-agent", service_port: 4317, protocol: "tcp" },
	{ service: "otel-agent", service_port: 4318, protocol: "tcp" },
	{ service: "traefik", service_port: 80, protocol: "tcp" },
	{ service: "traefik", service_port: 443, protocol: "tcp" },
	{ service: "web_nginx", service_port: 80, protocol: "tcp" },
	{ service: "landing_nginx", service_port: 80, protocol: "tcp" },
	{ service: "api_maintenance", service_port: 80, protocol: "tcp" },
] as const;
type WireguardPeer = {
	public_key: string;
	allowed_ip: string;
	added_at: string;
};
type WireguardState = {
	private_key: string;
	public_key: string;
	listen_port: number;
	network: string;
	server_ip: string;
	peers: WireguardPeer[];
};
type DockerServicePort = {
	PublishedPort?: number;
	TargetPort?: number;
	Protocol?: string;
	PublishMode?: string;
};
type DockerTaskInspect = {
	NetworksAttachments?: Array<{
		Network?: {
			Spec?: {
				Name?: string;
			};
		};
		Addresses?: string[];
	}>;
	Status?: {
		ContainerStatus?: {
			ContainerID?: string;
		};
	};
};
type EnterpriseLicenseCertificateBundle = {
	certificate_pem: string;
	private_key_pem: string;
	root_ca_pem: string;
	serial_hex: string;
	certificate_fingerprint_sha256: string;
	root_ca_fingerprint_sha256: string;
	issued_at: string;
	expires_at: string;
	metadata: {
		license_key_hash: string;
		install_fingerprint: string;
		stack_name: string;
		root_domain: string;
		edition: "enterprise";
	};
};

const HOST_ROOT = process.env.ENVSYNC_HOST_ROOT ?? "/opt/envsync";
const ETC_ROOT = process.env.ENVSYNC_ETC_ROOT ?? "/etc/envsync";
const TRAEFIK_STATE_ROOT = process.env.ENVSYNC_TRAEFIK_STATE_ROOT ?? "/var/lib/envsync/traefik";
const DEPLOY_ROOT = path.join(HOST_ROOT, "deploy");
const RELEASES_ROOT = path.join(HOST_ROOT, "releases");
const BACKUPS_ROOT = path.join(HOST_ROOT, "backups");
const REPO_ROOT = process.env.ENVSYNC_REPO_ROOT ?? path.join(HOST_ROOT, "repo");
const DEPLOY_ENV = path.join(ETC_ROOT, "deploy.env");
const DEPLOY_YAML = path.join(ETC_ROOT, "deploy.yaml");
const WIREGUARD_ROOT = path.join(ETC_ROOT, "wireguard");
const LICENSE_ROOT = path.join(ETC_ROOT, "license");
const LICENSE_BUNDLE_FILE = path.join(LICENSE_ROOT, "enterprise-license-bundle.json");
const LICENSE_CERT_FILE = path.join(LICENSE_ROOT, "enterprise-cert.pem");
const LICENSE_KEY_FILE = path.join(LICENSE_ROOT, "enterprise-key.pem");
const LICENSE_ROOT_CA_FILE = path.join(LICENSE_ROOT, "root-ca.pem");
const LICENSE_FILE_MODE = 0o644;
const LICENSE_DIR_MODE = 0o755;
const VERSIONS_LOCK = path.join(DEPLOY_ROOT, "versions.lock.json");
const STACK_FILE = path.join(DEPLOY_ROOT, "docker-stack.yaml");
const BOOTSTRAP_BASE_STACK_FILE = path.join(DEPLOY_ROOT, "docker-stack.bootstrap.base.yaml");
const BOOTSTRAP_STACK_FILE = path.join(DEPLOY_ROOT, "docker-stack.bootstrap.yaml");
const TRAEFIK_DYNAMIC_FILE = path.join(DEPLOY_ROOT, "traefik-dynamic.yaml");
const KEYCLOAK_REALM_FILE = path.join(DEPLOY_ROOT, "keycloak-realm.envsync.json");
const NGINX_WEB_CONF = path.join(DEPLOY_ROOT, "nginx-web.conf");
const NGINX_LANDING_CONF = path.join(DEPLOY_ROOT, "nginx-landing.conf");
const NGINX_API_MAINTENANCE_CONF = path.join(DEPLOY_ROOT, "nginx-api-maintenance.conf");
const NGINX_VPN_CONF = path.join(DEPLOY_ROOT, "nginx-vpn.conf");
const OTEL_AGENT_CONF = path.join(DEPLOY_ROOT, "otel-agent.yaml");
const CLICKSTACK_CLICKHOUSE_CONF = path.join(DEPLOY_ROOT, "clickhouse-listen.xml");
const INTERNAL_CONFIG_JSON = path.join(DEPLOY_ROOT, "config.json");
const UPGRADE_BACKUPS_ROOT = path.join(BACKUPS_ROOT, "upgrade");
const WIREGUARD_STATE_FILE = path.join(WIREGUARD_ROOT, "state.json");
const WIREGUARD_PRIVATE_KEY_FILE = path.join(WIREGUARD_ROOT, "server-private.key");
const WIREGUARD_PUBLIC_KEY_FILE = path.join(WIREGUARD_ROOT, "server-public.key");
const WIREGUARD_CONFIG_FILE = path.join(WIREGUARD_ROOT, "envsync-wg.conf");
const DEPLOY_RENDER_PATHS = {
	traefikStateRoot: TRAEFIK_STATE_ROOT,
	deployRoot: DEPLOY_ROOT,
	releasesRoot: RELEASES_ROOT,
	keycloakRealmFile: KEYCLOAK_REALM_FILE,
	clickstackClickhouseConf: CLICKSTACK_CLICKHOUSE_CONF,
	otelAgentConf: OTEL_AGENT_CONF,
	nginxLandingConf: NGINX_LANDING_CONF,
	nginxWebConf: NGINX_WEB_CONF,
	nginxApiMaintenanceConf: NGINX_API_MAINTENANCE_CONF,
	nginxVpnConf: NGINX_VPN_CONF,
} as const;

const REMOVE_TARGETS = [
	DEPLOY_ROOT,
	RELEASES_ROOT,
	BACKUPS_ROOT,
	TRAEFIK_STATE_ROOT,
	REPO_ROOT,
	DEPLOY_ENV,
	DEPLOY_YAML,
	LICENSE_ROOT,
	LICENSE_BUNDLE_FILE,
	LICENSE_CERT_FILE,
	LICENSE_KEY_FILE,
	LICENSE_ROOT_CA_FILE,
	INTERNAL_CONFIG_JSON,
	VERSIONS_LOCK,
	WIREGUARD_ROOT,
	WIREGUARD_STATE_FILE,
	WIREGUARD_PRIVATE_KEY_FILE,
	WIREGUARD_PUBLIC_KEY_FILE,
	WIREGUARD_CONFIG_FILE,
	STACK_FILE,
	BOOTSTRAP_BASE_STACK_FILE,
	BOOTSTRAP_STACK_FILE,
	TRAEFIK_DYNAMIC_FILE,
	KEYCLOAK_REALM_FILE,
	NGINX_WEB_CONF,
	NGINX_LANDING_CONF,
	NGINX_API_MAINTENANCE_CONF,
	OTEL_AGENT_CONF,
	CLICKSTACK_CLICKHOUSE_CONF,
] as const;

const REMOVE_CONFIRMATION_TOKEN = "YES, DO IT";

const STACK_VOLUMES = [
	"postgres_data",
	"redis_data",
	"rustfs_data",
	"keycloak_db_data",
	"openfga_db_data",
	"minikms_db_data",
	"clickstack_data",
	"clickstack_ch_data",
	"clickstack_ch_logs",
] as const;

const REQUIRED_BOOTSTRAP_ENV_KEYS = [
	"S3_SECRET_KEY",
	"KEYCLOAK_WEB_CLIENT_SECRET",
	"KEYCLOAK_API_CLIENT_SECRET",
	"OPENFGA_DB_PASSWORD",
	"MINIKMS_ROOT_KEY",
	"MINIKMS_DB_PASSWORD",
	"OPENFGA_STORE_ID",
	"OPENFGA_MODEL_ID",
] as const;

const REQUIRED_CLICKSTACK_SAVED_SEARCHES = [
	"Frontend Errors - Web",
	"Frontend Errors - Landing",
	"API Errors",
	"Org Onboarding Completed",
	"Apps Created",
	"Users Invited",
	"Webhooks Created",
	"Slow API Traces",
	"Frontend API Calls",
] as const;

const REQUIRED_CLICKSTACK_TAGS = [
	"envsync",
	"frontend",
	"backend",
	"onboarding",
	"applications",
	"webhooks",
	"errors",
	"performance",
	"alerts",
] as const;
const CLICKSTACK_SELFHOST_TEAM_NAME = "EnvSync Self-Hosted Team";

const SEMVER_VERSION_RE = /^\d+\.\d+\.\d+$/;
let currentOptions: CommandOptions = { dryRun: false, force: false };
const DEFAULT_SOURCE_REPO_URL = "https://github.com/EnvSync-Cloud/envsync.git";
const DEFAULT_ENTERPRISE_LICENSE_SERVER_URL = "https://license.envsync.cloud";
const MANAGED_VERSIONED_IMAGE_PREFIXES = {
	api: "ghcr.io/envsync-cloud/envsync-api:",
	management_api: "ghcr.io/envsync-cloud/envsync-management-api:",
	keycloak: "envsync-keycloak:",
	web: "ghcr.io/envsync-cloud/envsync-web-static:",
	landing: "ghcr.io/envsync-cloud/envsync-landing-static:",
} as const;

function formatShellArg(arg: string) {
	if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(arg)) return arg;
	return JSON.stringify(arg);
}

function formatCommand(cmd: string, args: string[]) {
	return [cmd, ...args].map(formatShellArg).join(" ");
}

function logSection(title: string) {
	console.log(`\n${chalk.bold.blue(title)}`);
}

function logStep(message: string) {
	console.log(`${chalk.cyan("[step]")} ${message}`);
}

function logInfo(message: string) {
	console.log(`${chalk.blue("[info]")} ${message}`);
}

function logSuccess(message: string) {
	console.log(`${chalk.green("[ok]")} ${message}`);
}

function logWarn(message: string) {
	console.log(`${chalk.yellow("[warn]")} ${message}`);
}

function logDryRun(message: string) {
	console.log(`${chalk.magenta("[dry-run]")} ${message}`);
}

function cmdEnterpriseTopologyPlan(configPath = DEPLOY_YAML, json = false) {
	const plan = loadDeploymentPlanFromFile(configPath, "enterprise");
	console.log(formatDeploymentPlan(plan, json ? "json" : "yaml"));
}

function cmdEnterpriseTopologyValidate(configPath = DEPLOY_YAML, json = false) {
	const plan = loadDeploymentPlanFromFile(configPath, "enterprise");
	if (json) {
		console.log(JSON.stringify({ valid: true, edition: plan.edition, warnings: plan.warnings }, null, 2));
		return;
	}
	logSuccess("Enterprise topology is valid.");
	for (const warning of plan.warnings) {
		logWarn(warning);
	}
}

function logCommand(cmd: string, args: string[]) {
	console.log(chalk.dim(`$ ${formatCommand(cmd, args)}`));
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string>; quiet?: boolean } = {}) {
	const result = spawnSync(cmd, args, {
		cwd: opts.cwd,
		env: { ...process.env, ...opts.env },
		stdio: opts.quiet ? "pipe" : "inherit",
		encoding: "utf8",
	});
	if (result.status !== 0) {
		const stderr = typeof result.stderr === "string" ? result.stderr : "";
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
	}
	return result.stdout?.toString() ?? "";
}

function runCapture(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string>; input?: string } = {}) {
	const result = spawnSync(cmd, args, {
		cwd: opts.cwd,
		env: { ...process.env, ...opts.env },
		input: opts.input,
		stdio: "pipe",
		encoding: "utf8",
	});
	if (result.status !== 0) {
		const stderr = typeof result.stderr === "string" ? result.stderr : "";
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
	}
	return (result.stdout ?? "").toString().trim();
}

function chunkByMax<T>(items: T[], max: number) {
	if (items.length === 0) return [];
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += max) {
		chunks.push(items.slice(i, i + max));
	}
	return chunks;
}

function formatPortRangesForIptables(ports: number[]) {
	const sortedPorts = Array.from(new Set(ports))
		.map(port => parseInt(String(port), 10))
		.filter(port => Number.isInteger(port) && port >= 1 && port <= 65535)
		.sort((a, b) => a - b);
	if (sortedPorts.length === 0) return [];

	const ranges: string[] = [];
	let rangeStart = sortedPorts[0];
	let previous = sortedPorts[0];

	for (let i = 1; i < sortedPorts.length; i++) {
		const current = sortedPorts[i];
		if (current === previous + 1) {
			previous = current;
			continue;
		}
		ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}:${previous}`);
		rangeStart = current;
		previous = current;
	}
	ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}:${previous}`);
	return ranges;
}

function formatNetutilsFirewallRules(config: DeployConfig | null) {
	if (!config?.netutils?.enabled || !Array.isArray(config.netutils.forwards) || config.netutils.forwards.length === 0) {
		return [] as string[];
	}
	const tcpPorts = config.netutils.forwards.filter(item => item.protocol === "tcp").map(item => item.host_port);
	const udpPorts = config.netutils.forwards.filter(item => item.protocol === "udp").map(item => item.host_port);
	const tcpRanges = formatPortRangesForIptables(tcpPorts);
	const udpRanges = formatPortRangesForIptables(udpPorts);
	if (tcpRanges.length === 0 && udpRanges.length === 0) return [];

	const lines: string[] = [];
	const addRules = (protocol: "tcp" | "udp", ranges: string[]) => {
		for (const chunk of chunkByMax(ranges, 15)) {
			const portSpec = chunk.join(",");
			lines.push(
				`PostUp = iptables -I DOCKER-USER -i envsync-wg -p ${protocol} -m multiport --dports ${portSpec} -j ACCEPT`,
			);
			lines.push(`PostUp = iptables -A DOCKER-USER -p ${protocol} -m multiport --dports ${portSpec} -j DROP`);
			lines.push(
				`PostDown = iptables -D DOCKER-USER -p ${protocol} -m multiport --dports ${portSpec} -j DROP`,
			);
			lines.push(
				`PostDown = iptables -D DOCKER-USER -i envsync-wg -p ${protocol} -m multiport --dports ${portSpec} -j ACCEPT`,
			);
		}
	};
	addRules("tcp", tcpRanges);
	addRules("udp", udpRanges);
	return lines;
}

function tryLoadOptionalConfig(): DeployConfig | null {
	try {
		return loadConfig();
	} catch {
		return null;
	}
}

function parseJsonOrDefault<T>(value: string, fallback: T): T {
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function tryRun(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string>; quiet?: boolean } = {}) {
	try {
		return run(cmd, args, opts);
	} catch {
		return "";
	}
}

function commandSucceeds(cmd: string, args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}) {
	const result = spawnSync(cmd, args, {
		cwd: opts.cwd,
		env: { ...process.env, ...opts.env },
		stdio: "ignore",
		encoding: "utf8",
	});
	return result.status === 0;
}

function runIgnoringAbsent(
	cmd: string,
	args: string[],
	opts: { cwd?: string; env?: Record<string, string>; absentPatterns?: string[] } = {},
) {
	const result = spawnSync(cmd, args, {
		cwd: opts.cwd,
		env: { ...process.env, ...opts.env },
		stdio: "pipe",
		encoding: "utf8",
	});
	if (result.status === 0) {
		const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
		if (stdout) console.log(stdout);
		return true;
	}
	const combined = `${typeof result.stdout === "string" ? result.stdout : ""}\n${typeof result.stderr === "string" ? result.stderr : ""}`
		.toLowerCase();
	const absentPatterns = (opts.absentPatterns ?? []).map(pattern => pattern.toLowerCase());
	if (absentPatterns.some(pattern => combined.includes(pattern))) {
		return false;
	}
	const stderr = typeof result.stderr === "string" ? result.stderr : "";
	throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeFile(target: string, content: string, mode?: number) {
	ensureDir(path.dirname(target));
	fs.writeFileSync(target, content, "utf8");
	if (mode != null) fs.chmodSync(target, mode);
}

function writeFileMaybe(target: string, content: string, mode?: number) {
	if (currentOptions.dryRun) {
		logDryRun(`Would write ${target}`);
		return;
	}
	writeFile(target, content, mode);
}

function ensureEnterpriseLicenseFilesReadable() {
	if (exists(LICENSE_ROOT)) {
		try {
			fs.chmodSync(LICENSE_ROOT, LICENSE_DIR_MODE);
		} catch {
			throw new Error(
				`Cannot update directory mode for ${LICENSE_ROOT}. Fix by running: chmod ${LICENSE_DIR_MODE.toString(8)} ${LICENSE_ROOT}`,
			);
		}
	}
	for (const filePath of [LICENSE_BUNDLE_FILE, LICENSE_CERT_FILE, LICENSE_KEY_FILE, LICENSE_ROOT_CA_FILE]) {
		if (!exists(filePath)) continue;
		try {
			fs.chmodSync(filePath, LICENSE_FILE_MODE);
		} catch {
			// Surface a clear, actionable error so users can recover outside automation.
			throw new Error(
				`Cannot update file mode for ${filePath}. Fix by running: chmod ${LICENSE_FILE_MODE.toString(8)} ${filePath}`,
			);
		}
	}
}

function exists(target: string) {
	return fs.existsSync(target);
}

function randomSecret(bytes = 24) {
	return randomBytes(bytes).toString("hex");
}

function deterministicInstallFingerprint(rootDomain: string, stackName: string) {
	return `envsync-${createHash("sha256").update(`${rootDomain}:${stackName}`).digest("hex").slice(0, 32)}`;
}

function randomStrongPassword() {
	return `EnvSync!${randomBytes(8).toString("hex")}Aa1`;
}

function randomWireguardPort() {
	return randomInt(50000, 65535);
}

function parsePort(value: unknown, label: string) {
	const numericValue = typeof value === "string" ? Number(value.trim()) : Number(value);
	if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 65535) {
		throw new Error(`Invalid ${label}: expected an integer from 1 to 65535.`);
	}
	return numericValue;
}

function parseNetutilsForwardsFromInput(raw: string, stackName: string) {
	const chunks = asStringList(raw);
	if (chunks.length === 0) {
		return [] as NetutilsForward[];
	}
	const candidates = chunks.map(chunk => {
		const parts = chunk.split(":");
		if (parts.length < 3 || parts.length > 4) {
			throw new Error(
				`Invalid netutils forward '${chunk}'. Expected format service:service_port:host_port[:protocol].`,
			);
		}
		return {
			service: parts[0].trim(),
			service_port: parts[1].trim(),
			host_port: parts[2].trim(),
			protocol: parts[3] ?? "tcp",
		};
	});
	return normalizeNetutilsForwards(candidates, stackName, true).forwards;
}

function buildNetutilsExposeAllForwards(stackName: string) {
	const candidates = NETUTILS_EXPOSE_ALL_PORTS.map((forward, index) => ({
		service: forward.service,
		service_port: forward.service_port,
		host_port: NETUTILS_EXPOSE_ALL_START_PORT + index,
		protocol: forward.protocol,
	}));
	return normalizeNetutilsForwards(candidates, stackName, true).forwards;
}

function normalizeNetutilsProtocol(raw: unknown) {
	if (typeof raw === "string") {
		const protocol = raw.toLowerCase();
		if (protocol === "tcp" || protocol === "udp") return protocol;
		throw new Error(`Invalid protocol '${raw}'. Supported values are tcp or udp.`);
	}
	return "tcp";
}

function normalizeNetutilsForwards(raw: unknown, stackName: string, enabled: boolean) {
	if (!Array.isArray(raw)) {
		return {
			enabled,
			forwards: [] as NetutilsForward[],
		};
	}
	const usedHostPorts = new Set<string>();
	const unique = new Set<string>();
	const forwards: NetutilsForward[] = [];
	for (const entry of raw) {
		const candidate = (entry ?? {}) as {
			service?: unknown;
			service_port?: unknown;
			host_port?: unknown;
			protocol?: unknown;
		};
		const rawService = typeof candidate.service === "string" ? candidate.service.trim() : "";
		if (!rawService) {
			throw new Error("Invalid netutils forward: missing service");
		}
		const service = rawService.includes(".") || rawService.includes(":") || rawService.startsWith(`${stackName}_`)
			? rawService
			: rawService;
		const servicePort = parsePort(candidate.service_port, "service_port");
		const hostPort = parsePort(candidate.host_port, "host_port");
		const protocol = normalizeNetutilsProtocol(candidate.protocol);
		const mapKey = `${service}:${servicePort}:${hostPort}:${protocol}`;
		if (unique.has(mapKey)) {
			continue;
		}
		const hostKey = `${protocol}:${hostPort}`;
		if (usedHostPorts.has(hostKey)) {
			throw new Error(
				`Duplicate netutils host port mapping detected for ${protocol.toUpperCase()} ${hostPort}. Use unique host ports per protocol.`,
			);
		}
		unique.add(mapKey);
		usedHostPorts.add(hostKey);
		forwards.push({
			service,
			service_port: servicePort,
			host_port: hostPort,
			protocol,
		});
	}
	forwards.sort((a, b) => {
		if (a.protocol !== b.protocol) return a.protocol.localeCompare(b.protocol);
		if (a.host_port !== b.host_port) return a.host_port - b.host_port;
		return a.service.localeCompare(b.service);
	});
	return {
		enabled,
		forwards,
	};
}

function loadWireguardState(): WireguardState | null {
	if (!exists(WIREGUARD_STATE_FILE)) return null;
	const raw = JSON.parse(fs.readFileSync(WIREGUARD_STATE_FILE, "utf8")) as WireguardState;
	return {
		private_key: raw.private_key,
		public_key: raw.public_key,
		listen_port: raw.listen_port,
		network: raw.network,
		server_ip: raw.server_ip,
		peers: Array.isArray(raw.peers) ? raw.peers : [],
	};
}

function saveWireguardState(state: WireguardState) {
	if (currentOptions.dryRun) {
		logDryRun(`Would save WireGuard state to ${WIREGUARD_STATE_FILE}`);
		return;
	}
	writeFile(WIREGUARD_STATE_FILE, JSON.stringify(state, null, 2), 0o600);
}

function ensureWireguardState(): WireguardState {
	ensureDir(WIREGUARD_ROOT);
	let state: WireguardState | null = loadWireguardState();
	if (state) {
		state.private_key = state.private_key?.trim();
		state.public_key = state.public_key?.trim();
		state.network = state.network || "10.66.0.0/24";
		state.server_ip = state.server_ip || "10.66.0.1";
		state.listen_port = state.listen_port || randomWireguardPort();
		state.peers = Array.isArray(state.peers) ? state.peers : [];
		if (state.private_key && !state.public_key) {
			state.public_key = runCapture("wg", ["pubkey"], { input: `${state.private_key}\n` });
		}
		if (!state.private_key || !state.public_key) {
			state = null;
		}
	}
	if (!state) {
		const privateKey = runCapture("wg", ["genkey"]);
		const publicKey = runCapture("wg", ["pubkey"], { input: `${privateKey}\n` });
		state = {
			private_key: privateKey,
			public_key: publicKey,
			listen_port: randomWireguardPort(),
			network: "10.66.0.0/24",
			server_ip: "10.66.0.1",
			peers: [],
		};
		saveWireguardState(state);
	}
	writeFileMaybe(WIREGUARD_PRIVATE_KEY_FILE, `${state.private_key}\n`, 0o600);
	writeFileMaybe(WIREGUARD_PUBLIC_KEY_FILE, `${state.public_key}\n`);
	return state;
}

function wireguardPeerAllowedIp(state: WireguardState) {
	const usedIps = new Set(state.peers.map(peer => peer.allowed_ip));
	for (let i = 2; i <= 254; i++) {
		const candidate = `${state.server_ip.split(".").slice(0, 3).join(".")}.${i}/32`;
		if (!usedIps.has(candidate)) {
			return candidate;
		}
	}
	throw new Error("WireGuard client IP pool exhausted in subnet 10.66.0.0/24.");
}

function writeWireguardConfig(state: WireguardState) {
	const config = tryLoadOptionalConfig();
	const netutilsFirewallRules = formatNetutilsFirewallRules(config);
	const peersSection = state.peers
		.map(peer => `\n[Peer]\nPublicKey = ${peer.public_key}\nAllowedIPs = ${peer.allowed_ip}`)
		.join("\n");
	const content = `[Interface]
Address = ${state.server_ip}/24
ListenPort = ${state.listen_port}
PrivateKey = ${state.private_key}
PostUp = iptables -A FORWARD -i envsync-wg -j ACCEPT
PostDown = iptables -D FORWARD -i envsync-wg -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
${netutilsFirewallRules.join("\n")}
${peersSection}
`;
	writeFileMaybe(WIREGUARD_CONFIG_FILE, content);
}

function emptyApiSlotState(): ApiSlotState {
	return {
		api_image: "",
		release_version: "",
		deployed_at: "",
	};
}

function normalizeApiSlot(value: unknown): ApiSlot {
	return value === "green" ? "green" : "blue";
}

function normalizeApiSlotState(raw?: Partial<ApiSlotState>): ApiSlotState {
	const defaults = emptyApiSlotState();
	return {
		api_image: raw?.api_image ?? defaults.api_image,
		release_version: raw?.release_version ?? defaults.release_version,
		deployed_at: raw?.deployed_at ?? defaults.deployed_at,
	};
}

function otherApiSlot(slot: ApiSlot): ApiSlot {
	return slot === "blue" ? "green" : "blue";
}

function toYaml(value: unknown, indent = 0): string {
	return YAML.stringify(value, {
		indent: Math.max(2, indent || 2),
	});
}

function parseSimpleYamlObject(input: string): Record<string, unknown> {
	const parsed = YAML.parse(input);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`Invalid deploy config in ${DEPLOY_YAML}. Expected a YAML object at the document root.`);
	}
	return parsed as Record<string, unknown>;
}

function parseEnvFile(content: string): RuntimeEnv {
	const out: RuntimeEnv = {};
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\"/g, '"');
		}
		out[key] = value;
	}
	return out;
}

function asBool(value: string) {
	return value.trim().toLowerCase() === "true" || value.trim().toLowerCase() === "y" || value.trim().toLowerCase() === "yes";
}

function asStringList(value: string) {
	return value
		.split(",")
		.map(item => item.trim())
		.filter(item => item.length > 0);
}

async function ask(question: string, fallback = ""): Promise<string> {
	if (!process.stdin.isTTY) return fallback;
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return await new Promise(resolve => {
		rl.question(fallback ? `${question} [${fallback}]: ` : `${question}: `, answer => {
			rl.close();
			resolve(answer.trim() || fallback);
		});
	});
}

async function askRequired(question: string, context = "Operation"): Promise<string> {
	if (!process.stdin.isTTY) {
		throw new Error(`${context} confirmation requires an interactive terminal. Re-run with --force to bypass the prompt.`);
	}
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	return await new Promise(resolve => {
		rl.question(`${question} `, answer => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

function sleepSeconds(seconds: number) {
	spawnSync("sleep", [`${seconds}`], { stdio: "ignore" });
}

function domainMap(rootDomain: string) {
	return {
		landing: rootDomain,
		app: `app.${rootDomain}`,
		api: `api.${rootDomain}`,
		manage_api: `manage-api.${rootDomain}`,
		auth: `auth.${rootDomain}`,
		obs: `obs.${rootDomain}`,
		mail: `mail.${rootDomain}`,
		s3: `s3.${rootDomain}`,
		s3Console: `console.s3.${rootDomain}`,
	};
}

function publicHttpsOrigin(config: DeployConfig, host: string) {
	return `https://${host}${config.services.public_https_port === 443 ? "" : `:${config.services.public_https_port}`}`;
}

function publicHttpsUrl(config: DeployConfig, host: string, path = "") {
	return `${publicHttpsOrigin(config, host)}${path}`;
}

function publicBucketUrl(config: DeployConfig, host: string, bucket: string) {
	return publicHttpsUrl(config, host, `/${bucket}`);
}

function publicHttpsOriginVariants(config: DeployConfig, host: string) {
	const canonical = `https://${host}`;
	if (config.services.public_https_port === 443) {
		return [canonical];
	}
	return [canonical, publicHttpsOrigin(config, host)];
}

function publicHttpsUrlVariants(config: DeployConfig, host: string, path = "") {
	return publicHttpsOriginVariants(config, host).map(origin => `${origin}${path}`);
}

function getDeployCliVersion() {
	try {
		const packageJsonPath = new URL("../package.json", import.meta.url);
		const raw = fs.readFileSync(packageJsonPath, "utf8");
		return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
	} catch {
		return process.env.npm_package_version ?? "0.0.0";
	}
}

function hasExplicitRepoOverride() {
	return typeof process.env.ENVSYNC_REPO_ROOT === "string" && process.env.ENVSYNC_REPO_ROOT.length > 0;
}

function logReleaseContext(config: DeployConfig) {
	const cliVersion = getDeployCliVersion();
	logInfo(`Configured release version from ${DEPLOY_YAML}: ${config.release.version}`);
	logInfo(`Running deploy-cli version: ${cliVersion}`);
	if (cliVersion !== config.release.version) {
		logWarn(
			`The running deploy-cli version does not change the configured release target. This run will deploy the version pinned in ${DEPLOY_YAML}.`,
		);
	}
}

function renderHelpBlock() {
	return [
		`${chalk.bold("EnvSync Self-Host Deploy CLI")}`,
		"",
		`${chalk.dim("Usage")}`,
		"  envsync-deploy <command> [options]",
		"",
		`${chalk.dim("Commands")}`,
		"  preinstall           Prepare the host with Docker, Swarm, and required packages",
		"  setup                Write /etc/envsync/deploy.yaml for a new self-hosted install",
		"  bootstrap            Destructively rebuild managed infra and bootstrap runtime state",
		"  remove               Remove local self-hosted deployment files and runtime resources",
		"  deploy               Deploy the configured release",
		"  promote [blue|green] Promote the requested or inactive API slot",
		"  rollback             Switch traffic back to the previous API slot",
		"  health [--json]      Show operator health or machine-readable health JSON",
		"  plan-topology [file] Render the Enterprise topology plan from deploy.yaml",
		"  validate-topology    Validate Enterprise edition topology rules",
		"  upgrade [version]    Pin a target release and deploy it",
		"  upgrade-deps         Refresh dependency images and redeploy",
		"  vpn pubkey           Generate or print WireGuard server public key",
		"  vpn whitelist <key>  Add a client public key to allowed peers",
		"  vpn status           Show WireGuard server/peer status",
		"  license issue-cert   Issue and install an Enterprise certificate bundle",
		"  license renew-cert   Renew and install the Enterprise certificate bundle",
		"  license validate-cert Validate the installed Enterprise certificate bundle files",
		"  backup               Create a managed self-host backup archive",
		"  restore <archive>    Restore a backup archive into the managed self-host roots",
		"",
		`${chalk.dim("Options")}`,
		"  --dry-run            Preview mutating work without changing the host",
		"  --force              Skip destructive confirmations where supported",
		"  --deploy             Used with restore to start services after restore",
	].join("\n");
}

type OperatorOverview = {
	statusLines: string[];
	nextSteps: string[];
};

function buildOperatorOverview(): OperatorOverview {
	const statusLines = [
		`CLI version: ${chalk.cyan(getDeployCliVersion())}`,
		`Config path: ${chalk.dim(DEPLOY_YAML)}`,
	];

	const dockerReady = commandSucceeds("docker", ["info"]);
	statusLines.push(`Docker: ${dockerReady ? chalk.green("available") : chalk.red("not available")}`);

	if (!exists(DEPLOY_YAML)) {
		statusLines.push(`Configured: ${chalk.red("no")}`);
		return {
			statusLines,
			nextSteps: [
				"`envsync-deploy preinstall` if this host has not been prepared yet",
				"`envsync-deploy setup` to create the self-host deploy config",
			],
		};
	}

	const { config, generated } = loadState();
	const services = listStackServices(config);
	const stackRunning = stackExists(config);
	const bootstrapComplete = hasCompleteBootstrapState(generated) && generated.bootstrap.completed_at.length > 0;
	const api = apiHealth(services, config.services.stack_name);
	const web = serviceHealth(services, `${config.services.stack_name}_web_nginx`);
	const landing = serviceHealth(services, `${config.services.stack_name}_landing_nginx`);

	statusLines.push(`Configured: ${chalk.green("yes")}`);
	statusLines.push(`Pinned release: ${chalk.cyan(config.release.version)}`);
	statusLines.push(`Stack: ${stackRunning ? chalk.green(config.services.stack_name) : chalk.yellow("not running")}`);
	statusLines.push(`Bootstrap: ${bootstrapComplete ? chalk.green("complete") : chalk.yellow("pending")}`);
	statusLines.push(`Active API slot: ${chalk.cyan(generated.deployment.active_slot)}`);
	statusLines.push(`API: ${api === "healthy" ? chalk.green(api) : api === "missing" ? chalk.red(api) : chalk.yellow(api)}`);
	statusLines.push(`Web: ${web === "healthy" ? chalk.green(web) : web === "missing" ? chalk.red(web) : chalk.yellow(web)}`);
	statusLines.push(`Landing: ${landing === "healthy" ? chalk.green(landing) : landing === "missing" ? chalk.red(landing) : chalk.yellow(landing)}`);

	if (!bootstrapComplete) {
		return {
			statusLines,
			nextSteps: [
				"`envsync-deploy bootstrap` to create infrastructure, runtime secrets, and generated state",
				"`envsync-deploy bootstrap --force` for non-interactive automation",
			],
		};
	}

	if (api !== "healthy" || web !== "healthy" || landing !== "healthy") {
		return {
			statusLines,
			nextSteps: [
				"`envsync-deploy deploy` to reconcile services to the pinned release",
				"`envsync-deploy health --json` to inspect exact slot and observability state",
			],
		};
	}

	return {
		statusLines,
		nextSteps: [
			"`envsync-deploy health --json` for machine-readable checks",
			"`envsync-deploy upgrade` to move to the current deploy-cli release",
			"`envsync-deploy backup` before an upgrade or major change",
		],
	};
}

function printOperatorOverview() {
	const overview = buildOperatorOverview();
	const commonCommands = [
		"`envsync-deploy setup`",
		"`envsync-deploy remove --force`",
		"`envsync-deploy bootstrap --force`",
		"`envsync-deploy deploy`",
		"`envsync-deploy upgrade`",
		"`envsync-deploy license issue-cert`",
		"`envsync-deploy health --json`",
		"`envsync-deploy plan-topology --json`",
		"`envsync-deploy backup`",
		"`envsync-deploy restore <archive>`",
		"`envsync-deploy promote`",
		"`envsync-deploy rollback`",
	];
	const importantNotes = [
		"`bootstrap` is destructive",
		"`upgrade` updates the pinned release target automatically",
		"blue/green keeps the previous API slot for rollback",
		"self-hosted release targets must be exact semver values",
	];

	console.log(chalk.bold("EnvSync Self-Host Deploy CLI"));
	printHealthSection("Current Status");
	for (const line of overview.statusLines) {
		console.log(`  ${line}`);
	}

	printHealthSection("Recommended Next Step");
	for (const line of overview.nextSteps) {
		console.log(`  - ${line}`);
	}

	printHealthSection("Common Commands");
	for (const line of commonCommands) {
		console.log(`  - ${line}`);
	}

	printHealthSection("Important Notes");
	for (const line of importantNotes) {
		console.log(`  - ${line}`);
	}
}

function assertSemverVersion(version: string, label = "release version") {
	if (!SEMVER_VERSION_RE.test(version)) {
		throw new Error(`Invalid ${label} '${version}'. Expected an exact semver like 0.6.2.`);
	}
}

function versionedImages(version: string) {
	assertSemverVersion(version);
	return {
		api: `ghcr.io/envsync-cloud/envsync-api:${version}`,
		management_api: `ghcr.io/envsync-cloud/envsync-management-api:${version}`,
		keycloak: `envsync-keycloak:${version}`,
		web: `ghcr.io/envsync-cloud/envsync-web-static:${version}`,
		landing: `ghcr.io/envsync-cloud/envsync-landing-static:${version}`,
	};
}

function defaultSourceConfig(version: string) {
	return {
		repo_url: DEFAULT_SOURCE_REPO_URL,
		ref: `v${version}`,
	};
}

function isOssConfig(config: DeployConfig) {
	return config.edition === "oss";
}

function isManagedVersionedImage(
	image: string | undefined,
	key: keyof Pick<DeployConfig["images"], "api" | "keycloak" | "web" | "landing" | "management_api">,
) {
	return typeof image === "string" && image.startsWith(MANAGED_VERSIONED_IMAGE_PREFIXES[key]);
}

function resolveReleaseVersion(raw: Partial<DeployConfig>) {
	const releaseVersion = raw.release?.version;
	if (releaseVersion) {
		assertSemverVersion(releaseVersion);
		return releaseVersion;
	}
	if (typeof raw.release_channel === "string" && raw.release_channel.length > 0) {
		if (SEMVER_VERSION_RE.test(raw.release_channel)) {
			return raw.release_channel;
		}
		if (raw.release_channel === "stable" || raw.release_channel === "latest") {
			throw new Error(
				"Legacy release channel config is no longer supported for self-hosted installs. Set an exact release version in /etc/envsync/deploy.yaml.",
			);
		}
		throw new Error(`Invalid legacy release channel '${raw.release_channel}'. Set an exact release version in /etc/envsync/deploy.yaml.`);
	}
	return getDeployCliVersion();
}

function requireDefined<T>(value: T | undefined, label: string): T {
	if (value === undefined) {
		throw new Error(`Missing ${label} in ${DEPLOY_YAML}. Run setup again.`);
	}
	return value;
}

function normalizeConfig(raw: Partial<DeployConfig>): DeployConfig {
	const version = resolveReleaseVersion(raw);
	const derivedImages = versionedImages(version);
	const { release_channel: _legacyReleaseChannel, ...rest } = raw;
	const rootDomain = requireDefined(raw.domain?.root_domain, "domain.root_domain");
	const acmeEmail = requireDefined(raw.domain?.acme_email, "domain.acme_email");
	const stackName = requireDefined(raw.services?.stack_name, "services.stack_name");
	return {
		...rest,
		edition: raw.edition ?? "enterprise",
		source: {
			repo_url: raw.source?.repo_url ?? DEFAULT_SOURCE_REPO_URL,
			ref: `v${version}`,
		},
		release: {
			version,
		},
		domain: {
			root_domain: rootDomain,
			acme_email: acmeEmail,
		},
		images: {
			api: !raw.images?.api || isManagedVersionedImage(raw.images.api, "api") ? derivedImages.api : raw.images.api,
			management_api: !raw.images?.management_api || isManagedVersionedImage(raw.images.management_api, "management_api")
				? derivedImages.management_api
				: raw.images.management_api,
			keycloak: !raw.images?.keycloak || isManagedVersionedImage(raw.images.keycloak, "keycloak")
				? derivedImages.keycloak
				: raw.images.keycloak,
			web: !raw.images?.web || isManagedVersionedImage(raw.images.web, "web") ? derivedImages.web : raw.images.web,
			landing: !raw.images?.landing || isManagedVersionedImage(raw.images.landing, "landing")
				? derivedImages.landing
				: raw.images.landing,
			clickstack: raw.images?.clickstack ?? "clickhouse/clickstack-all-in-one:latest",
			traefik: raw.images?.traefik ?? "traefik:v3.6.6",
			otel_agent: raw.images?.otel_agent ?? "otel/opentelemetry-collector-contrib:0.111.0",
		},
		services: {
			stack_name: stackName,
			api_port: requireDefined(raw.services?.api_port, "services.api_port"),
			management_api_port: raw.services?.management_api_port ?? 4001,
			public_http_port: raw.services?.public_http_port ?? 80,
			public_https_port: raw.services?.public_https_port ?? 443,
			clickstack_ui_port: requireDefined(raw.services?.clickstack_ui_port, "services.clickstack_ui_port"),
			clickstack_otlp_http_port: requireDefined(raw.services?.clickstack_otlp_http_port, "services.clickstack_otlp_http_port"),
			clickstack_otlp_grpc_port: requireDefined(raw.services?.clickstack_otlp_grpc_port, "services.clickstack_otlp_grpc_port"),
			keycloak_port: requireDefined(raw.services?.keycloak_port, "services.keycloak_port"),
			rustfs_port: requireDefined(raw.services?.rustfs_port, "services.rustfs_port"),
			rustfs_console_port: requireDefined(raw.services?.rustfs_console_port, "services.rustfs_console_port"),
		},
		auth: {
			keycloak_realm: requireDefined(raw.auth?.keycloak_realm, "auth.keycloak_realm"),
			admin_user: requireDefined(raw.auth?.admin_user, "auth.admin_user"),
			admin_password: requireDefined(raw.auth?.admin_password, "auth.admin_password"),
			web_client_id: requireDefined(raw.auth?.web_client_id, "auth.web_client_id"),
			api_client_id: requireDefined(raw.auth?.api_client_id, "auth.api_client_id"),
			cli_client_id: requireDefined(raw.auth?.cli_client_id, "auth.cli_client_id"),
		},
		observability: {
			retention_days: requireDefined(raw.observability?.retention_days, "observability.retention_days"),
			public_obs: requireDefined(raw.observability?.public_obs, "observability.public_obs"),
			alert_webhook_url: raw.observability?.alert_webhook_url,
			alert_webhook_headers: raw.observability?.alert_webhook_headers ?? {},
		},
		backup: {
			output_dir: requireDefined(raw.backup?.output_dir, "backup.output_dir"),
			encrypted: requireDefined(raw.backup?.encrypted, "backup.encrypted"),
		},
		smtp: {
			host: requireDefined(raw.smtp?.host, "smtp.host"),
			port: requireDefined(raw.smtp?.port, "smtp.port"),
			secure: requireDefined(raw.smtp?.secure, "smtp.secure"),
			user: requireDefined(raw.smtp?.user, "smtp.user"),
			pass: requireDefined(raw.smtp?.pass, "smtp.pass"),
			from: requireDefined(raw.smtp?.from, "smtp.from"),
		},
		exposure: {
			public_auth: requireDefined(raw.exposure?.public_auth, "exposure.public_auth"),
			public_obs: requireDefined(raw.exposure?.public_obs, "exposure.public_obs"),
			mailpit_enabled: requireDefined(raw.exposure?.mailpit_enabled, "exposure.mailpit_enabled"),
			s3_public: requireDefined(raw.exposure?.s3_public, "exposure.s3_public"),
			s3_console_public: requireDefined(raw.exposure?.s3_console_public, "exposure.s3_console_public"),
		},
		upgrade: {
			maintenance_mode_enabled: raw.upgrade?.maintenance_mode_enabled ?? true,
			db_snapshot_on_api_upgrade: raw.upgrade?.db_snapshot_on_api_upgrade ?? true,
			keep_failed_upgrade_db_snapshot: raw.upgrade?.keep_failed_upgrade_db_snapshot ?? true,
		},
		netutils: normalizeNetutilsForwards(raw.netutils?.forwards, stackName, raw.netutils?.enabled ?? false),
		vpn: {
			provider: raw.vpn?.provider ?? "none",
			internal_domain: raw.vpn?.internal_domain ?? "envsync.local",
			nb_setup_key: raw.vpn?.nb_setup_key ?? "",
		},
		license: raw.license ? {
			server_url: raw.license.server_url,
			key: raw.license.key,
			install_fingerprint: raw.license.install_fingerprint ?? deterministicInstallFingerprint(rootDomain, stackName),
			certificate_bundle_file: raw.license.certificate_bundle_file,
			lease_ttl_seconds: raw.license.lease_ttl_seconds,
			certificate_validity_days: raw.license.certificate_validity_days,
		} : raw.edition === "oss" ? undefined : {
			install_fingerprint: deterministicInstallFingerprint(rootDomain, stackName),
			certificate_validity_days: 1095,
		},
	};
}

function emptyGeneratedState(): DeployGeneratedState {
	return {
		openfga: {
			store_id: "",
			model_id: "",
		},
		deployment: {
			active_slot: "blue",
			previous_slot: "",
			maintenance_mode: false,
			slots: {
				blue: emptyApiSlotState(),
				green: emptyApiSlotState(),
			},
		},
		clickstack: {
			operator_email: "",
			operator_password: "",
			access_key: "",
			browser_api_key: "",
		},
		secrets: {
			s3_secret_key: "",
			keycloak_db_password: "",
			keycloak_web_client_secret: "",
			keycloak_api_client_secret: "",
			openfga_db_password: "",
			minikms_root_key: "",
			minikms_db_password: "",
		},
		bootstrap: {
			completed_at: "",
		},
	};
}

function normalizeGeneratedState(raw?: Partial<DeployGeneratedState>): DeployGeneratedState {
	const defaults = emptyGeneratedState();
	return {
		openfga: {
			store_id: raw?.openfga?.store_id ?? defaults.openfga.store_id,
			model_id: raw?.openfga?.model_id ?? defaults.openfga.model_id,
		},
		deployment: {
			active_slot: normalizeApiSlot(raw?.deployment?.active_slot ?? defaults.deployment.active_slot),
			previous_slot: raw?.deployment?.previous_slot === "blue" || raw?.deployment?.previous_slot === "green"
				? raw.deployment.previous_slot
				: defaults.deployment.previous_slot,
			maintenance_mode: raw?.deployment?.maintenance_mode ?? defaults.deployment.maintenance_mode,
			slots: {
				blue: normalizeApiSlotState(raw?.deployment?.slots?.blue),
				green: normalizeApiSlotState(raw?.deployment?.slots?.green),
			},
		},
		clickstack: {
			operator_email: raw?.clickstack?.operator_email ?? defaults.clickstack.operator_email,
			operator_password: raw?.clickstack?.operator_password ?? defaults.clickstack.operator_password,
			access_key: raw?.clickstack?.access_key ?? defaults.clickstack.access_key,
			browser_api_key: raw?.clickstack?.browser_api_key ?? defaults.clickstack.browser_api_key,
		},
		secrets: {
			s3_secret_key: raw?.secrets?.s3_secret_key ?? defaults.secrets.s3_secret_key,
			keycloak_db_password: raw?.secrets?.keycloak_db_password ?? defaults.secrets.keycloak_db_password,
			keycloak_web_client_secret: raw?.secrets?.keycloak_web_client_secret ?? defaults.secrets.keycloak_web_client_secret,
			keycloak_api_client_secret: raw?.secrets?.keycloak_api_client_secret ?? defaults.secrets.keycloak_api_client_secret,
			openfga_db_password: raw?.secrets?.openfga_db_password ?? defaults.secrets.openfga_db_password,
			minikms_root_key: raw?.secrets?.minikms_root_key ?? defaults.secrets.minikms_root_key,
			minikms_db_password: raw?.secrets?.minikms_db_password ?? defaults.secrets.minikms_db_password,
		},
		bootstrap: {
			completed_at: raw?.bootstrap?.completed_at ?? defaults.bootstrap.completed_at,
		},
	};
}

function readInternalState() {
	if (!exists(INTERNAL_CONFIG_JSON)) return null;
	const raw = JSON.parse(fs.readFileSync(INTERNAL_CONFIG_JSON, "utf8")) as Partial<InternalState>;
	return {
		config: raw.config ? normalizeConfig(raw.config) : undefined,
		generated: normalizeGeneratedState(raw.generated),
	};
}

function loadConfig(): DeployConfig {
	if (!exists(DEPLOY_YAML)) {
		throw new Error(`Missing deploy config at ${DEPLOY_YAML}. Run setup first.`);
	}
	const raw = fs.readFileSync(DEPLOY_YAML, "utf8");
	if (raw.trimStart().startsWith("{")) {
		return normalizeConfig(JSON.parse(raw) as DeployConfig);
	}
	return normalizeConfig(parseSimpleYamlObject(raw) as unknown as DeployConfig);
}

function loadGeneratedEnv() {
	if (!exists(DEPLOY_ENV)) return {};
	return parseEnvFile(fs.readFileSync(DEPLOY_ENV, "utf8"));
}

function mergeGeneratedState(env: RuntimeEnv, generated?: Partial<DeployGeneratedState>) {
	const normalized = normalizeGeneratedState(generated);
	return normalizeGeneratedState({
		openfga: {
			store_id: env.OPENFGA_STORE_ID ?? normalized.openfga.store_id,
			model_id: env.OPENFGA_MODEL_ID ?? normalized.openfga.model_id,
		},
		deployment: normalized.deployment,
		clickstack: {
			operator_email: env.CLICKSTACK_OPERATOR_EMAIL ?? normalized.clickstack.operator_email,
			operator_password: env.CLICKSTACK_OPERATOR_PASSWORD ?? normalized.clickstack.operator_password,
			access_key: env.CLICKSTACK_ACCESS_KEY ?? normalized.clickstack.access_key,
			browser_api_key: env.CLICKSTACK_BROWSER_API_KEY ?? normalized.clickstack.browser_api_key,
		},
		secrets: {
			s3_secret_key: env.S3_SECRET_KEY ?? normalized.secrets.s3_secret_key,
			keycloak_db_password: env.KEYCLOAK_DB_PASSWORD ?? normalized.secrets.keycloak_db_password,
			keycloak_web_client_secret: env.KEYCLOAK_WEB_CLIENT_SECRET ?? normalized.secrets.keycloak_web_client_secret,
			keycloak_api_client_secret: env.KEYCLOAK_API_CLIENT_SECRET ?? normalized.secrets.keycloak_api_client_secret,
			openfga_db_password: env.OPENFGA_DB_PASSWORD ?? normalized.secrets.openfga_db_password,
			minikms_root_key: env.MINIKMS_ROOT_KEY ?? normalized.secrets.minikms_root_key,
			minikms_db_password: env.MINIKMS_DB_PASSWORD ?? normalized.secrets.minikms_db_password,
		},
		bootstrap: normalized.bootstrap,
	});
}

function loadState() {
	const config = loadConfig();
	const internal = readInternalState();
	const generated = mergeGeneratedState(loadGeneratedEnv(), internal?.generated);
	return { config, generated };
}

function ensureGeneratedRuntimeState(config: DeployConfig, generated: DeployGeneratedState) {
	return normalizeGeneratedState({
		openfga: generated.openfga,
		deployment: generated.deployment,
		clickstack: {
			operator_email: generated.clickstack.operator_email || `operator@${config.domain.root_domain}`,
			operator_password: generated.clickstack.operator_password || randomStrongPassword(),
			access_key: generated.clickstack.access_key || `envsync-selfhost-${config.domain.root_domain}-dashboard-access-key`,
			browser_api_key: generated.clickstack.browser_api_key,
		},
		secrets: {
			s3_secret_key: generated.secrets.s3_secret_key || randomSecret(16),
			keycloak_db_password: generated.secrets.keycloak_db_password || "",
			keycloak_web_client_secret: generated.secrets.keycloak_web_client_secret || randomSecret(),
			keycloak_api_client_secret: generated.secrets.keycloak_api_client_secret || randomSecret(),
			openfga_db_password: generated.secrets.openfga_db_password || randomSecret(),
			minikms_root_key: generated.secrets.minikms_root_key || randomBytes(32).toString("hex"),
			minikms_db_password: generated.secrets.minikms_db_password || randomSecret(),
		},
		bootstrap: generated.bootstrap,
	});
}

function resetBootstrapGeneratedState(generated: DeployGeneratedState) {
	return normalizeGeneratedState({
		openfga: {
			store_id: "",
			model_id: "",
		},
		deployment: {
			active_slot: "blue",
			previous_slot: "",
			maintenance_mode: false,
			slots: {
				blue: emptyApiSlotState(),
				green: emptyApiSlotState(),
			},
		},
		clickstack: generated.clickstack,
		secrets: generated.secrets,
		bootstrap: {
			completed_at: "",
		},
	});
}

function keycloakImageTag(image: string) {
	return image.split(":").slice(1).join(":") || "local";
}

function slotServiceName(slot: ApiSlot) {
	return `envsync_api_${slot}`;
}

function serviceStackName(config: DeployConfig, serviceName: string) {
	return `${config.services.stack_name}_${serviceName}`;
}

function slotStackServiceName(config: DeployConfig, slot: ApiSlot) {
	return serviceStackName(config, slotServiceName(slot));
}

function slotHasApiDeployment(state: ApiSlotState) {
	return state.api_image.length > 0;
}

function createSteadyApiDeploymentState(
	config: DeployConfig,
	generated: DeployGeneratedState,
): DeployGeneratedState["deployment"] {
	const deployment = normalizeGeneratedState(generated).deployment;
	const activeSlot = deployment.active_slot;
	const activeState = deployment.slots[activeSlot];
	if (slotHasApiDeployment(activeState)) {
		return deployment;
	}
	return {
		active_slot: activeSlot,
		previous_slot: "",
		maintenance_mode: deployment.maintenance_mode,
		slots: {
			...deployment.slots,
			[activeSlot]: {
				api_image: config.images.api,
				release_version: config.release.version,
				deployed_at: deployment.slots[activeSlot].deployed_at,
			},
		},
	};
}

function prepareApiSlotStateForTarget(state: ApiSlotState, config: DeployConfig) {
	return normalizeApiSlotState({
		...state,
		api_image: config.images.api,
		release_version: config.release.version,
	});
}

function stampApiSlotState(state: ApiSlotState, config: DeployConfig) {
	return normalizeApiSlotState({
		...state,
		api_image: config.images.api,
		release_version: config.release.version,
		deployed_at: new Date().toISOString(),
	});
}

function createPromotionCandidateState(
	config: DeployConfig,
	generated: DeployGeneratedState,
): DeployGeneratedState["deployment"] | null {
	const deployment = createSteadyApiDeploymentState(config, generated);
	const activeSlot = deployment.active_slot;
	const activeState = deployment.slots[activeSlot];
	if (!slotHasApiDeployment(activeState) || activeState.api_image === config.images.api) {
		return null;
	}
	const targetSlot = otherApiSlot(activeSlot);
	return normalizeGeneratedState({
		...generated,
		deployment: {
			active_slot: activeSlot,
			previous_slot: deployment.previous_slot,
			maintenance_mode: deployment.maintenance_mode,
			slots: {
				...deployment.slots,
				[targetSlot]: prepareApiSlotStateForTarget(deployment.slots[targetSlot], config),
			},
		},
	}).deployment;
}

function createPromotedApiDeploymentState(
	config: DeployConfig,
	generated: DeployGeneratedState,
): DeployGeneratedState["deployment"] {
	const candidate = createPromotionCandidateState(config, generated);
	if (!candidate) {
		return createSteadyApiDeploymentState(config, generated);
	}
	const currentActive = candidate.active_slot;
	const targetSlot = otherApiSlot(currentActive);
	return {
		active_slot: targetSlot,
		previous_slot: currentActive,
		maintenance_mode: candidate.maintenance_mode,
		slots: {
			...candidate.slots,
			[targetSlot]: stampApiSlotState(candidate.slots[targetSlot], config),
		},
	};
}

function createRolledBackApiDeploymentState(generated: DeployGeneratedState): DeployGeneratedState["deployment"] {
	const deployment = generated.deployment;
	const rollbackSlot = deployment.previous_slot;
	if (!rollbackSlot) {
		throw new Error("No rollback target is available. A previous promoted slot has not been recorded yet.");
	}
	if (!slotHasApiDeployment(deployment.slots[rollbackSlot])) {
		throw new Error(`Rollback target slot '${rollbackSlot}' has no deployed API image recorded.`);
	}
	return {
		active_slot: rollbackSlot,
		previous_slot: deployment.active_slot,
		maintenance_mode: deployment.maintenance_mode,
		slots: deployment.slots,
	};
}

function markActiveApiSlotDeployed(config: DeployConfig, deployment: DeployGeneratedState["deployment"]) {
	const activeSlot = deployment.active_slot;
	if (!slotHasApiDeployment(deployment.slots[activeSlot])) {
		return deployment;
	}
	return {
		...deployment,
		slots: {
			...deployment.slots,
			[activeSlot]: stampApiSlotState(deployment.slots[activeSlot], config),
		},
	};
}

function touchApiSlotDeployment(deployment: DeployGeneratedState["deployment"], slot: ApiSlot) {
	if (!slotHasApiDeployment(deployment.slots[slot])) {
		return deployment;
	}
	return {
		...deployment,
		slots: {
			...deployment.slots,
			[slot]: {
				...deployment.slots[slot],
				deployed_at: new Date().toISOString(),
			},
		},
	};
}

function buildRuntimeEnv(config: DeployConfig, generated: DeployGeneratedState): RuntimeEnv {
	const hosts = domainMap(config.domain.root_domain);
	const bucketName = "envsync-bucket";
	const oss = isOssConfig(config);
	const enterprise = !oss;
	const license = config.license ?? {};
	return {
		NODE_ENV: "production",
		DB_AUTO_MIGRATE: "false",
		PORT: `${config.services.api_port}`,
		MANAGEMENT_API_PORT: `${config.services.management_api_port}`,
		ENVSYNC_EDITION: oss ? "oss" : "enterprise",
		ENVSYNC_MANAGEMENT_ENABLED: oss ? "false" : "true",
		ENVSYNC_LANDING_ENABLED: oss ? "false" : "true",
		ENVSYNC_SINGLE_ORG_MODE: oss ? "true" : "false",
		DATABASE_HOST: "postgres",
		DATABASE_PORT: "5432",
		DATABASE_USER: "postgres",
		DATABASE_PASSWORD: "envsync-postgres",
		DATABASE_NAME: "envsync",
		POSTGRES_USER: "postgres",
		POSTGRES_PASSWORD: "envsync-postgres",
		POSTGRES_DB: "envsync",
		S3_BUCKET: bucketName,
		S3_REGION: "us-east-1",
		S3_ACCESS_KEY: "envsync-rustfs",
		S3_SECRET_KEY: generated.secrets.s3_secret_key,
		S3_BUCKET_URL: publicBucketUrl(config, hosts.s3, bucketName),
		S3_ENDPOINT: "http://rustfs:9000",
		REDIS_URL: "redis://redis:6379",
		SMTP_HOST: config.smtp.host,
		SMTP_PORT: `${config.smtp.port}`,
		SMTP_SECURE: `${config.smtp.secure}`,
		SMTP_USER: config.smtp.user,
		SMTP_PASS: config.smtp.pass,
		SMTP_FROM: config.smtp.from,
		KEYCLOAK_URL: "http://keycloak:8080",
		KEYCLOAK_PUBLIC_URL: publicHttpsUrl(config, hosts.auth),
		KEYCLOAK_REALM: config.auth.keycloak_realm,
		KEYCLOAK_ADMIN_USER: config.auth.admin_user,
		KEYCLOAK_ADMIN_PASSWORD: config.auth.admin_password,
		KEYCLOAK_DB_PASSWORD: generated.secrets.keycloak_db_password || config.auth.admin_password,
		KEYCLOAK_WEB_CLIENT_ID: config.auth.web_client_id,
		KEYCLOAK_WEB_CLIENT_SECRET: generated.secrets.keycloak_web_client_secret,
		KEYCLOAK_CLI_CLIENT_ID: config.auth.cli_client_id,
		KEYCLOAK_API_CLIENT_ID: config.auth.api_client_id,
		KEYCLOAK_API_CLIENT_SECRET: generated.secrets.keycloak_api_client_secret,
		KEYCLOAK_WEB_REDIRECT_URI: publicHttpsUrl(config, hosts.api, "/api/access/web/callback"),
		KEYCLOAK_WEB_CALLBACK_URL: publicHttpsUrl(config, hosts.app, "/auth/callback"),
		KEYCLOAK_API_REDIRECT_URI: publicHttpsUrl(config, hosts.api, "/api/access/api/callback"),
		LANDING_PAGE_URL: publicHttpsUrl(config, hosts.landing),
		DASHBOARD_URL: publicHttpsUrl(config, hosts.app),
		MANAGEMENT_API_URL: oss ? "" : publicHttpsUrl(config, hosts.manage_api),
		OPENFGA_API_URL: "http://openfga:8090",
		OPENFGA_STORE_ID: generated.openfga.store_id,
		OPENFGA_MODEL_ID: generated.openfga.model_id,
		OPENFGA_DB_PASSWORD: generated.secrets.openfga_db_password,
		CLICKSTACK_OPERATOR_EMAIL: generated.clickstack.operator_email,
		CLICKSTACK_OPERATOR_PASSWORD: generated.clickstack.operator_password,
		CLICKSTACK_ACCESS_KEY: generated.clickstack.access_key,
		CLICKSTACK_BROWSER_API_KEY: generated.clickstack.browser_api_key,
		MINIKMS_GRPC_ADDR: "minikms:50051",
		MINIKMS_TLS_ENABLED: "false",
		MINIKMS_ROOT_KEY: generated.secrets.minikms_root_key,
		MINIKMS_DB_USER: "postgres",
		MINIKMS_DB_PASSWORD: generated.secrets.minikms_db_password,
		OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-agent:4318",
		OTEL_SERVICE_NAME: "envsync-api",
		OTEL_SDK_DISABLED: "false",
		ENVSYNC_LICENSE_MODE: "certificate",
		ENVSYNC_LICENSE_SERVER_URL: enterprise ? (license.server_url ?? "") : "",
		ENVSYNC_LICENSE_KEY: enterprise ? (license.key ?? "") : "",
		ENVSYNC_INSTALL_FINGERPRINT: enterprise ? (license.install_fingerprint ?? "") : "",
		ENVSYNC_LICENSE_LEASE_TTL_SECONDS: String(license.lease_ttl_seconds ?? 300),
		ENVSYNC_STACK_NAME: config.services.stack_name,
		ENVSYNC_LICENSE_BUNDLE_PATH: "/etc/envsync/license/enterprise-license-bundle.json",
		ENVSYNC_LICENSE_CERT_PATH: "/etc/envsync/license/enterprise-cert.pem",
		ENVSYNC_LICENSE_KEY_PATH: "/etc/envsync/license/enterprise-key.pem",
		ENVSYNC_LICENSE_ROOT_CA_CERT_PATH: "/etc/envsync/license/root-ca.pem",
		CLICKSTACK_URL: publicHttpsUrl(config, hosts.obs),
		KEYCLOAK_IMAGE_TAG: keycloakImageTag(config.images.keycloak),
	};
}

function renderEnvFile(env: RuntimeEnv) {
	return Object.entries(env)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join("\n") + "\n";
}

function renderEnvList(values: Record<string, string | number | boolean>, indent = 6) {
	const prefix = " ".repeat(indent);
	return Object.entries(values)
		.map(([key, value]) => `${prefix}- ${JSON.stringify(`${key}=${String(value)}`)}`)
		.join("\n");
}

function renderKeycloakRealm(config: DeployConfig, runtimeEnv: RuntimeEnv) {
	const hosts = domainMap(config.domain.root_domain);
	const webRedirectUris = [
		...publicHttpsUrlVariants(config, hosts.api, "/api/access/web/callback"),
		...publicHttpsUrlVariants(config, hosts.app, "/auth/callback"),
		...publicHttpsUrlVariants(config, hosts.app),
	];
	const webOrigins = publicHttpsOriginVariants(config, hosts.app);
	const apiRedirectUris = publicHttpsUrlVariants(config, hosts.api, "/api/access/api/callback");
	const apiOrigins = publicHttpsOriginVariants(config, hosts.api);
	return JSON.stringify(
		{
			realm: config.auth.keycloak_realm,
			enabled: true,
			loginTheme: "envsync",
			emailTheme: "envsync",
			clients: [
				{
					clientId: config.auth.web_client_id,
					name: "EnvSync Web",
					protocol: "openid-connect",
					publicClient: false,
					secret: runtimeEnv.KEYCLOAK_WEB_CLIENT_SECRET,
					standardFlowEnabled: true,
					directAccessGrantsEnabled: false,
					redirectUris: [...new Set(webRedirectUris)],
					webOrigins: [...new Set(webOrigins)],
					attributes: {
						"post.logout.redirect.uris": "+",
					},
					defaultClientScopes: ["basic", "web-origins", "profile", "email", "roles"],
				},
				{
					clientId: config.auth.api_client_id,
					name: "EnvSync API",
					protocol: "openid-connect",
					publicClient: false,
					secret: runtimeEnv.KEYCLOAK_API_CLIENT_SECRET,
					standardFlowEnabled: true,
					redirectUris: [...new Set(apiRedirectUris)],
					webOrigins: [...new Set(apiOrigins)],
					defaultClientScopes: ["basic", "profile", "email", "roles"],
				},
				{
					clientId: config.auth.cli_client_id,
					name: "EnvSync CLI",
					protocol: "openid-connect",
					publicClient: true,
					standardFlowEnabled: false,
					directAccessGrantsEnabled: false,
					attributes: {
						"oauth2.device.authorization.grant.enabled": "true",
					},
					defaultClientScopes: ["basic", "profile", "email", "roles"],
				},
			],
		},
		null,
		2,
	) + "\n";
}

function renderTraefikDynamicConfig(config: DeployConfig, generated: DeployGeneratedState) {
	const hosts = domainMap(config.domain.root_domain);
	const activeSlot = generated.deployment.active_slot;
	const apiServiceName = generated.deployment.maintenance_mode ? "envsync-api-maintenance" : "envsync-api";
	const landingEnabled = !isOssConfig(config);
	const managementEnabled = !isOssConfig(config);
	const otelAllowedOrigins = [
		...(landingEnabled ? publicHttpsOriginVariants(config, hosts.landing) : []),
		...publicHttpsOriginVariants(config, hosts.app),
	];
	return [
		"http:",
		"  middlewares:",
		"    secure-headers:",
		"      headers:",
		"        browserXssFilter: true",
		"        contentTypeNosniff: true",
		"        forceSTSHeader: true",
		"        stsSeconds: 31536000",
		"    gzip:",
		"      compress: {}",
		"    otel-cors:",
		"      headers:",
		"        accessControlAllowOriginList:",
		...otelAllowedOrigins.map(origin => `          - ${origin}`),
		"        accessControlAllowMethods:",
		"          - POST",
		"          - OPTIONS",
		"        accessControlAllowHeaders:",
		"          - Content-Type",
		"          - content-type",
		"          - Content-Encoding",
		"          - content-encoding",
		"          - Authorization",
		"          - authorization",
		"        accessControlAllowCredentials: true",
		"        accessControlMaxAge: 600",
		"        addVaryHeader: true",
		"  services:",
		"    envsync-api:",
		"      loadBalancer:",
		"        healthCheck:",
		"          path: /health",
		"          interval: 5s",
		"          timeout: 3s",
		"        servers:",
		`          - url: http://${slotServiceName(activeSlot)}:4000`,
		"    envsync-api-blue:",
		"      loadBalancer:",
		"        healthCheck:",
		"          path: /health",
		"          interval: 5s",
		"          timeout: 3s",
		"        servers:",
		"          - url: http://envsync_api_blue:4000",
		"    envsync-api-green:",
		"      loadBalancer:",
		"        healthCheck:",
		"          path: /health",
		"          interval: 5s",
		"          timeout: 3s",
		"        servers:",
		"          - url: http://envsync_api_green:4000",
		"    envsync-api-maintenance:",
		"      loadBalancer:",
		"        servers:",
		"          - url: http://api_maintenance:8080",
		...(managementEnabled ? [
			"    envsync-management-api:",
			"      loadBalancer:",
			"        healthCheck:",
			"          path: /health",
			"          interval: 5s",
			"          timeout: 3s",
			"        servers:",
			`          - url: http://envsync-management-api:${config.services.management_api_port}`,
		] : []),
		...(landingEnabled ? [
			"    landing:",
			"      loadBalancer:",
			"        servers:",
			"          - url: http://landing_nginx:8080",
		] : []),
		"    web:",
		"      loadBalancer:",
		"        servers:",
		"          - url: http://web_nginx:8080",
		"    clickstack-ui:",
		"      loadBalancer:",
		"        servers:",
		"          - url: http://clickstack:8080",
		"    clickstack-otlp:",
		"      loadBalancer:",
		"        servers:",
		`          - url: http://clickstack:${config.services.clickstack_otlp_http_port}`,
		"  routers:",
		...(landingEnabled ? [
			"    landing-router:",
			`      rule: Host(\`${hosts.landing}\`)`,
			"      service: landing",
			"      entryPoints: [websecure]",
			"      tls:",
			"        certResolver: letsencrypt",
		] : []),
		"    web-router:",
		`      rule: Host(\`${hosts.app}\`)`,
		"      service: web",
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
		"    obs-otlp-router:",
		`      rule: Host(\`${hosts.obs}\`) && (PathPrefix(\`/v1/traces\`) || PathPrefix(\`/v1/logs\`) || PathPrefix(\`/v1/metrics\`))`,
		"      service: clickstack-otlp",
		"      middlewares: [otel-cors]",
		"      priority: 100",
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
		"    obs-api-router:",
		`      rule: Host(\`${hosts.obs}\`) && PathPrefix(\`/api\`)`,
		"      service: clickstack-ui",
		"      priority: 90",
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
		"    obs-ui-router:",
		`      rule: Host(\`${hosts.obs}\`)`,
		"      service: clickstack-ui",
		"      priority: 10",
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
		...(managementEnabled ? [
			"    management-api-router:",
			`      rule: Host(\`${hosts.manage_api}\`)`,
			"      service: envsync-management-api",
			"      entryPoints: [websecure]",
			"      tls:",
			"        certResolver: letsencrypt",
		] : []),
		"    api-router:",
		`      rule: Host(\`${hosts.api}\`)`,
		`      service: ${apiServiceName}`,
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
	].join("\n") + "\n";
}

function renderNginxConf(kind: "web" | "landing") {
	return [
		"server {",
		"  listen 8080;",
		"  server_name _;",
		`  root /srv/${kind};`,
		"  index index.html;",
		"  location = /runtime-config.js {",
		"    add_header Cache-Control \"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0\" always;",
		"    add_header Pragma \"no-cache\" always;",
		"    add_header Expires \"0\" always;",
		"    try_files /runtime-config.js =404;",
		"  }",
		"  location = /index.html {",
		"    add_header Cache-Control \"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0\" always;",
		"    add_header Pragma \"no-cache\" always;",
		"    add_header Expires \"0\" always;",
		"    try_files /index.html =404;",
		"  }",
		"  location / {",
		"    try_files $uri $uri/ /index.html;",
		"  }",
		"}",
	].join("\n") + "\n";
}

function renderApiMaintenanceConf() {
	return [
		"server {",
		"  listen 8080;",
		"  server_name _;",
		"  location / {",
		"    default_type application/json;",
		"    add_header Cache-Control \"no-store\" always;",
		"    return 503 '{\"error\":\"Upgrade in progress. Please retry shortly.\"}';",
		"  }",
		"}",
	].join("\n") + "\n";
}

function renderFrontendRuntimeConfig(config: DeployConfig, generated: DeployGeneratedState) {
	const hosts = domainMap(config.domain.root_domain);
	const otelEndpoint = publicHttpsUrl(config, hosts.obs);
	const managementApiEnabled = !isOssConfig(config);
	const activeReleaseVersion = generated.deployment.slots[generated.deployment.active_slot].release_version || config.release.version;
	const edition = isOssConfig(config) ? "oss" : "enterprise";
	return `window.__ENVSYNC_RUNTIME_CONFIG__ = ${JSON.stringify({
		apiBaseUrl: publicHttpsUrl(config, hosts.api),
		appBaseUrl: publicHttpsUrl(config, hosts.app),
		authBaseUrl: publicHttpsUrl(config, hosts.auth),
		managementApiUrl: managementApiEnabled ? publicHttpsUrl(config, hosts.manage_api) : "",
		keycloakRealm: config.auth.keycloak_realm,
		webClientId: config.auth.web_client_id,
		apiDocsUrl: publicHttpsUrl(config, hosts.api, "/docs"),
		edition,
		dashboardVariant: edition,
		managementEnabled: managementApiEnabled,
		deploymentMode: "selfhosted",
		canCreateOrganization: false,
		publicSignupEnabled: false,
		maxOrgs: 1,
		otelEndpoint,
		hyperdxApiKey: generated.clickstack.browser_api_key || undefined,
		hyperdxUrl: otelEndpoint,
		hyperdxDisabled: generated.clickstack.browser_api_key.length === 0,
		hyperdxAdvancedNetworkCapture: false,
		releaseVersion: activeReleaseVersion,
		activeApiSlot: generated.deployment.active_slot,
	}, null, 2)};\n`;
}

function renderOtelAgentConfig(config: DeployConfig) {
	return [
		"receivers:",
		"  otlp:",
		"    protocols:",
		"      grpc:",
		"        endpoint: 0.0.0.0:4317",
		"      http:",
		"        endpoint: 0.0.0.0:4318",
		"processors:",
		"  batch: {}",
		"  resource:",
		"    attributes:",
		"      - key: deployment.environment",
		"        value: production",
		"        action: upsert",
		"exporters:",
		"  otlphttp/clickstack:",
		`    endpoint: http://clickstack:${config.services.clickstack_otlp_http_port}`,
		"service:",
		"  pipelines:",
		"    traces:",
		"      receivers: [otlp]",
		"      processors: [resource, batch]",
		"      exporters: [otlphttp/clickstack]",
		"    logs:",
		"      receivers: [otlp]",
		"      processors: [resource, batch]",
		"      exporters: [otlphttp/clickstack]",
		"    metrics:",
		"      receivers: [otlp]",
		"      processors: [resource, batch]",
		"      exporters: [otlphttp/clickstack]",
	].join("\n") + "\n";
}

function renderClickstackClickHouseConfig() {
	return [
		"<clickhouse>",
		"  <listen_host>0.0.0.0</listen_host>",
		"  <listen_try>1</listen_try>",
		"</clickhouse>",
	].join("\n") + "\n";
}

function renderStack(config: DeployConfig, runtimeEnv: RuntimeEnv, generated: DeployGeneratedState, mode: "base" | "bootstrap" | "full") {
	const hosts = domainMap(config.domain.root_domain);
	const includeRuntimeInfra = mode !== "base";
	const includeAppServices = mode === "full";
	const managementEnabled = !isOssConfig(config);
	const apiLicenseVolume = managementEnabled ? "\n    volumes:\n      - /etc/envsync/license:/etc/envsync/license:ro" : "";
	const deployment = createSteadyApiDeploymentState(config, generated);
	const stackName = config.services.stack_name;
	const s3RouterName = `${stackName}-s3-router`;
	const s3ServiceName = `${stackName}-s3-service`;
	const s3ConsoleRouterName = `${stackName}-s3-console-router`;
	const s3ConsoleServiceName = `${stackName}-s3-console-service`;
	const apiEnvironment = {
		...runtimeEnv,
		OTEL_EXPORTER_OTLP_ENDPOINT: "http://otel-agent:4318",
		KEYCLOAK_URL: "http://keycloak:8080",
		OPENFGA_API_URL: "http://openfga:8090",
		MINIKMS_GRPC_ADDR: "minikms:50051",
		S3_ENDPOINT: "http://rustfs:9000",
		S3_BUCKET_URL: publicBucketUrl(config, hosts.s3, runtimeEnv.S3_BUCKET),
	};

	return `
version: "3.9"
services:
  traefik:
    image: ${config.images.traefik}
    command:
      - --providers.swarm=true
      - --providers.swarm.endpoint=unix:///var/run/docker.sock
      - --providers.swarm.exposedByDefault=false
      - --providers.file.filename=/etc/traefik/dynamic/traefik-dynamic.yaml
      - --entrypoints.web.address=:80
      - --entrypoints.web.http.redirections.entryPoint.to=websecure
      - --entrypoints.web.http.redirections.entryPoint.scheme=https
      - --entrypoints.web.http.redirections.entryPoint.permanent=true
      - --entrypoints.websecure.address=:443
      - --certificatesresolvers.letsencrypt.acme.email=${config.domain.acme_email}
      - --certificatesresolvers.letsencrypt.acme.storage=/var/lib/traefik/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge=true
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
    ports:
      - target: 80
        published: ${config.services.public_http_port}
        protocol: tcp
        mode: host
      - target: 443
        published: ${config.services.public_https_port}
        protocol: tcp
        mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ${TRAEFIK_STATE_ROOT}:/var/lib/traefik
      - ${DEPLOY_ROOT}:/etc/traefik/dynamic:ro
    networks: [envsync]

  postgres:
    image: postgres:17
    environment:
${renderEnvList({
		POSTGRES_USER: "postgres",
		POSTGRES_PASSWORD: "envsync-postgres",
		POSTGRES_DB: "envsync",
	})}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [envsync]

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
    networks: [envsync]

  rustfs:
    image: rustfs/rustfs:latest
    environment:
${renderEnvList({
		RUSTFS_DATA_DIR: "/data",
		RUSTFS_ACCESS_KEY: "envsync-rustfs",
		RUSTFS_SECRET_KEY: runtimeEnv.S3_SECRET_KEY,
		RUSTFS_CONSOLE_ENABLE: "true",
	})}
    volumes:
      - rustfs_data:/data
    networks: [envsync]
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.${s3RouterName}.rule=Host(\`${hosts.s3}\`)
        - traefik.http.routers.${s3RouterName}.entrypoints=websecure
        - traefik.http.routers.${s3RouterName}.tls.certresolver=letsencrypt
        - traefik.http.routers.${s3RouterName}.service=${s3ServiceName}
        - traefik.http.services.${s3ServiceName}.loadbalancer.server.port=9000
        - traefik.http.routers.${s3ConsoleRouterName}.rule=Host(\`${hosts.s3Console}\`)
        - traefik.http.routers.${s3ConsoleRouterName}.entrypoints=websecure
        - traefik.http.routers.${s3ConsoleRouterName}.tls.certresolver=letsencrypt
        - traefik.http.routers.${s3ConsoleRouterName}.service=${s3ConsoleServiceName}
        - traefik.http.services.${s3ConsoleServiceName}.loadbalancer.server.port=9001

  keycloak_db:
    image: postgres:17
    environment:
${renderEnvList({
		POSTGRES_USER: "keycloak",
		POSTGRES_PASSWORD: runtimeEnv.KEYCLOAK_DB_PASSWORD,
		POSTGRES_DB: "keycloak",
	})}
    volumes:
      - keycloak_db_data:/var/lib/postgresql/data
    networks: [envsync]
${includeRuntimeInfra ? `
  keycloak:
    image: ${config.images.keycloak}
    entrypoint: ["/bin/sh", "-lc"]
    command:
      - /opt/keycloak/bin/kc.sh import --dir /opt/keycloak/data/import --override true && exec /opt/keycloak/bin/kc.sh start --optimized
    environment:
${renderEnvList({
		KC_DB: "postgres",
		KC_DB_URL: "jdbc:postgresql://keycloak_db:5432/keycloak",
		KC_DB_USERNAME: "keycloak",
		KC_DB_PASSWORD: runtimeEnv.KEYCLOAK_DB_PASSWORD,
		KC_BOOTSTRAP_ADMIN_USERNAME: config.auth.admin_user,
		KC_BOOTSTRAP_ADMIN_PASSWORD: config.auth.admin_password,
		KC_HTTP_ENABLED: "true",
		KC_HEALTH_ENABLED: "true",
		KC_PROXY_HEADERS: "xforwarded",
		KC_HOSTNAME: hosts.auth,
		KC_HOSTNAME_STRICT: "false",
	})}
    configs:
      - source: keycloak_realm
        target: /opt/keycloak/data/import/realm.json
    networks: [envsync]
    deploy:
      labels:
        - traefik.enable=true
        - traefik.http.routers.keycloak.rule=Host(\`${hosts.auth}\`)
        - traefik.http.routers.keycloak.entrypoints=websecure
        - traefik.http.routers.keycloak.tls.certresolver=letsencrypt
        - traefik.http.services.keycloak.loadbalancer.server.port=8080` : ""}

  openfga_db:
    image: postgres:17
    environment:
${renderEnvList({
		POSTGRES_USER: "openfga",
		POSTGRES_PASSWORD: runtimeEnv.OPENFGA_DB_PASSWORD,
		POSTGRES_DB: "openfga",
	})}
    volumes:
      - openfga_db_data:/var/lib/postgresql/data
    networks: [envsync]
${includeRuntimeInfra ? `
  openfga:
    image: openfga/openfga:v1.12.0
    command: run
    environment:
${renderEnvList({
		OPENFGA_DATASTORE_ENGINE: "postgres",
		OPENFGA_DATASTORE_URI: `postgres://openfga:${runtimeEnv.OPENFGA_DB_PASSWORD}@openfga_db:5432/openfga?sslmode=disable`,
		OPENFGA_HTTP_ADDR: "0.0.0.0:8090",
		OPENFGA_GRPC_ADDR: "0.0.0.0:8091",
	})}
    networks: [envsync]` : ""}

  minikms_db:
    image: postgres:17
    environment:
${renderEnvList({
		POSTGRES_USER: "postgres",
		POSTGRES_PASSWORD: runtimeEnv.MINIKMS_DB_PASSWORD,
		POSTGRES_DB: "minikms",
	})}
    volumes:
      - minikms_db_data:/var/lib/postgresql/data
    networks: [envsync]
${includeRuntimeInfra ? `
  minikms:
    image: ghcr.io/envsync-cloud/minikms:sha-735dfe8
    environment:
${renderEnvList({
		MINIKMS_ROOT_KEY: runtimeEnv.MINIKMS_ROOT_KEY,
		MINIKMS_DB_URL: `postgres://postgres:${runtimeEnv.MINIKMS_DB_PASSWORD}@minikms_db:5432/minikms?sslmode=disable`,
		MINIKMS_REDIS_URL: "redis://redis:6379",
		MINIKMS_GRPC_ADDR: "0.0.0.0:50051",
		MINIKMS_TLS_ENABLED: "false",
	})}
    networks: [envsync]` : ""}

  clickstack:
    image: ${config.images.clickstack}
    environment:
${renderEnvList({
		HYPERDX_APP_URL: publicHttpsUrl(config, hosts.obs),
		HYPERDX_API_URL: publicHttpsUrl(config, hosts.obs),
		FRONTEND_URL: publicHttpsUrl(config, hosts.obs),
	})}
    volumes:
      - clickstack_data:/data/db
      - clickstack_ch_data:/var/lib/clickhouse
      - clickstack_ch_logs:/var/log/clickhouse-server
    configs:
      - source: clickstack_clickhouse_conf
        target: /etc/clickhouse-server/config.d/envsync-listen-host.xml
    networks: [envsync]
    healthcheck:
      disable: true

  otel-agent:
    image: ${config.images.otel_agent}
    command: ["--config=/etc/otel-agent.yaml"]
    configs:
      - source: otel_agent_conf
        target: /etc/otel-agent.yaml
    networks: [envsync]
${includeRuntimeInfra && managementEnabled ? `

  envsync-management-api:
    image: ${config.images.management_api}
    environment:
${renderEnvList({
		...apiEnvironment,
		PORT: `${config.services.management_api_port}`,
	})}
${apiLicenseVolume}
    networks: [envsync]` : ""}
${includeAppServices ? `

  api_maintenance:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_api_maintenance_conf
        target: /etc/nginx/conf.d/default.conf
    networks: [envsync]

  landing_nginx:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_landing_conf
        target: /etc/nginx/conf.d/default.conf
    volumes:
      - ${RELEASES_ROOT}/landing/current:/srv/landing:ro
    networks: [envsync]

  web_nginx:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_web_conf
        target: /etc/nginx/conf.d/default.conf
    volumes:
      - ${RELEASES_ROOT}/web/current:/srv/web:ro
    networks: [envsync]

  envsync_api_blue:
    image: ${deployment.slots.blue.api_image || config.images.api}
    environment:
${renderEnvList({
		...apiEnvironment,
		ENVSYNC_DEPLOY_SLOT: "blue",
		ENVSYNC_DEPLOY_RELEASE_VERSION: deployment.slots.blue.release_version || config.release.version,
	})}
    volumes:
      - /etc/envsync/license:/etc/envsync/license:ro
    networks: [envsync]
    deploy:
      replicas: ${slotHasApiDeployment(deployment.slots.blue) ? 1 : 0}

  envsync_api_green:
    image: ${deployment.slots.green.api_image || config.images.api}
    environment:
${renderEnvList({
		...apiEnvironment,
		ENVSYNC_DEPLOY_SLOT: "green",
		ENVSYNC_DEPLOY_RELEASE_VERSION: deployment.slots.green.release_version || config.release.version,
	})}
    volumes:
      - /etc/envsync/license:/etc/envsync/license:ro
    networks: [envsync]
    deploy:
      replicas: ${slotHasApiDeployment(deployment.slots.green) ? 1 : 0}` : ""}

networks:
  envsync:
    driver: overlay
    attachable: true

volumes:
  postgres_data:
  redis_data:
  rustfs_data:
  keycloak_db_data:
  openfga_db_data:
  minikms_db_data:
  clickstack_data:
  clickstack_ch_data:
  clickstack_ch_logs:

configs:
  keycloak_realm:
    file: ${KEYCLOAK_REALM_FILE}
  clickstack_clickhouse_conf:
    file: ${CLICKSTACK_CLICKHOUSE_CONF}
  otel_agent_conf:
    file: ${OTEL_AGENT_CONF}
  nginx_landing_conf:
    file: ${NGINX_LANDING_CONF}
  nginx_web_conf:
    file: ${NGINX_WEB_CONF}
  nginx_api_maintenance_conf:
    file: ${NGINX_API_MAINTENANCE_CONF}
`.trimStart();
}

function writeDeployArtifacts(config: DeployConfig, generated: DeployGeneratedState) {
	const runtimeEnv = renderHelpers.buildRuntimeEnv(config, generated);
	logStep("Rendering deploy artifacts");
	writeFileMaybe(DEPLOY_ENV, renderHelpers.renderEnvFile(runtimeEnv), 0o600);
	writeFileMaybe(
		INTERNAL_CONFIG_JSON,
		JSON.stringify({ config, generated: mergeGeneratedState(runtimeEnv, generated) }, null, 2) + "\n",
	);
	writeFileMaybe(VERSIONS_LOCK, JSON.stringify(config.images, null, 2) + "\n");
	writeFileMaybe(KEYCLOAK_REALM_FILE, renderHelpers.renderKeycloakRealm(config, runtimeEnv));
	writeFileMaybe(TRAEFIK_DYNAMIC_FILE, renderHelpers.renderTraefikDynamicConfig(config, generated));
	writeFileMaybe(BOOTSTRAP_BASE_STACK_FILE, renderHelpers.renderStack(config, runtimeEnv, generated, "base", DEPLOY_RENDER_PATHS));
	writeFileMaybe(BOOTSTRAP_STACK_FILE, renderHelpers.renderStack(config, runtimeEnv, generated, "bootstrap", DEPLOY_RENDER_PATHS));
	writeFileMaybe(STACK_FILE, renderHelpers.renderStack(config, runtimeEnv, generated, "full", DEPLOY_RENDER_PATHS));
	writeFileMaybe(NGINX_WEB_CONF, renderHelpers.renderNginxConf("web"));
	if (!isOssConfig(config)) {
		writeFileMaybe(NGINX_LANDING_CONF, renderHelpers.renderNginxConf("landing"));
	}
	writeFileMaybe(NGINX_API_MAINTENANCE_CONF, renderHelpers.renderApiMaintenanceConf());
	writeFileMaybe(OTEL_AGENT_CONF, renderHelpers.renderOtelAgentConfig(config));
	writeFileMaybe(CLICKSTACK_CLICKHOUSE_CONF, renderHelpers.renderClickstackClickHouseConfig());
	if (config.vpn?.provider && config.vpn.provider !== "none") {
		writeFileMaybe(NGINX_VPN_CONF, renderHelpers.renderNginxVpnConf(config));
	}
	logSuccess(currentOptions.dryRun ? "Deploy artifacts previewed" : "Deploy artifacts written");
}

function saveDesiredConfig(config: DeployConfig) {
	const internal = readInternalState();
	const generated = mergeGeneratedState(loadGeneratedEnv(), internal?.generated);
	logStep(`Saving desired config to ${DEPLOY_YAML}`);
	writeFileMaybe(DEPLOY_YAML, toYaml(config) + "\n");
	writeFileMaybe(
		INTERNAL_CONFIG_JSON,
		JSON.stringify({ config, generated }, null, 2) + "\n",
	);
	logSuccess(currentOptions.dryRun ? "Desired config previewed" : "Desired config saved");
}

function ensureRepoCheckout(config: DeployConfig) {
	logStep(`Ensuring pinned repo checkout at ${config.source.ref}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would ensure repo checkout at ${REPO_ROOT}`);
		return;
	}
	if (hasExplicitRepoOverride()) {
		if (!exists(path.join(REPO_ROOT, ".git"))) {
			throw new Error(`ENVSYNC_REPO_ROOT is set but no git repo was found at ${REPO_ROOT}`);
		}
		logInfo(`Using local repo override at ${REPO_ROOT}`);
		logSuccess("Local repo override is ready");
		return;
	}
	ensureDir(REPO_ROOT);
	if (!exists(path.join(REPO_ROOT, ".git"))) {
		logCommand("git", ["clone", config.source.repo_url, REPO_ROOT]);
		run("git", ["clone", config.source.repo_url, REPO_ROOT]);
	}
	logCommand("git", ["remote", "set-url", "origin", config.source.repo_url]);
	run("git", ["remote", "set-url", "origin", config.source.repo_url], { cwd: REPO_ROOT });
	logCommand("git", ["fetch", "--tags", "--force", "origin"]);
	run("git", ["fetch", "--tags", "--force", "origin"], { cwd: REPO_ROOT });
	logCommand("git", ["checkout", "--force", config.source.ref]);
	run("git", ["checkout", "--force", config.source.ref], { cwd: REPO_ROOT });
	logSuccess(`Pinned repo checkout ready at ${config.source.ref}`);
}

function extractStaticBundle(kind: "web" | "landing", image: string, targetDir: string) {
	logStep(`Extracting ${kind} static bundle from ${image}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would extract ${kind} bundle from ${image} into ${targetDir}`);
		return;
	}
	fs.rmSync(targetDir, { recursive: true, force: true });
	ensureDir(targetDir);
	const containerId = run("docker", ["create", image], { quiet: true }).trim();
	try {
		run("docker", ["cp", `${containerId}:/app/dist/.`, targetDir]);
	} finally {
		run("docker", ["rm", "-f", containerId], { quiet: true });
	}
	staticBundleHelpers.normalizeExtractedStaticBundle(kind, targetDir);
	staticBundleHelpers.validateStaticBundle(kind, targetDir);
	logSuccess(`${kind} static bundle extracted to ${targetDir}`);
}

function releaseAssetDir(kind: "web" | "landing", version: string) {
	return path.join(RELEASES_ROOT, kind, version);
}

function currentReleaseDir(kind: "web" | "landing") {
	return path.join(RELEASES_ROOT, kind, "current");
}

function stageFrontendRelease(kind: "web" | "landing", image: string, version: string) {
	const targetDir = releaseAssetDir(kind, version);
	extractStaticBundle(kind, image, targetDir);
}

function writeFrontendRuntimeConfig(targetDir: string, runtimeConfig: string) {
	writeFile(path.join(targetDir, "runtime-config.js"), runtimeConfig);
}

function syncFrontendReleaseContents(sourceDir: string, targetDir: string) {
	ensureDir(targetDir);
	const deferredEntries = new Set(["index.html", "runtime-config.js"]);
	const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

	for (const entry of entries) {
		if (deferredEntries.has(entry.name)) {
			continue;
		}
		fs.cpSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name), {
			recursive: true,
			force: true,
		});
	}

	const stagedRuntimeConfig = path.join(sourceDir, "runtime-config.js");
	if (exists(stagedRuntimeConfig)) {
		fs.cpSync(stagedRuntimeConfig, path.join(targetDir, "runtime-config.js"), { force: true });
	}

	const stagedIndex = path.join(sourceDir, "index.html");
	if (exists(stagedIndex)) {
		fs.cpSync(stagedIndex, path.join(targetDir, "index.html"), { force: true });
	}
}

function activateFrontendRelease(kind: "web" | "landing", version: string, runtimeConfig: string) {
	const stagedDir = releaseAssetDir(kind, version);
	const currentDir = currentReleaseDir(kind);
	if (currentOptions.dryRun) {
		logDryRun(`Would activate ${kind} release ${version} into ${currentDir}`);
		logDryRun(`Would write ${kind} runtime-config.js for release ${version}`);
		return;
	}
	if (!exists(stagedDir)) {
		throw new Error(`Missing staged ${kind} release at ${stagedDir}`);
	}
	staticBundleHelpers.validateStaticBundle(kind, stagedDir);
	writeFrontendRuntimeConfig(stagedDir, runtimeConfig);
	ensureDir(currentDir);
	syncFrontendReleaseContents(stagedDir, currentDir);
	staticBundleHelpers.validateStaticBundle(kind, currentDir);
}

function normalizeExtractedStaticBundle(kind: "web" | "landing", targetDir: string) {
	const directIndex = path.join(targetDir, "index.html");
	if (exists(directIndex)) {
		return;
	}

	const childDirs = fs
		.readdirSync(targetDir, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => path.join(targetDir, entry.name));

	const candidateRoots = childDirs.filter(dir => exists(path.join(dir, "index.html")));
	if (candidateRoots.length !== 1) {
		return;
	}

	const nestedRoot = candidateRoots[0];
	logWarn(`Detected nested ${kind} static bundle root at ${nestedRoot}; flattening into ${targetDir}.`);
	for (const entry of fs.readdirSync(nestedRoot)) {
		fs.cpSync(path.join(nestedRoot, entry), path.join(targetDir, entry), { recursive: true });
	}
	fs.rmSync(nestedRoot, { recursive: true, force: true });
}

function validateStaticBundle(kind: "web" | "landing", targetDir: string) {
	if (exists(path.join(targetDir, "index.html"))) {
		return;
	}

	const entries = exists(targetDir) ? fs.readdirSync(targetDir).slice(0, 20).join(", ") : "";
	throw new Error(
		`Invalid ${kind} static bundle at ${targetDir}: missing index.html${entries ? `. Found: ${entries}` : ""}`,
	);
}

function createApiDbUpgradeBackup(config: DeployConfig, fromVersion: string, toVersion: string) {
	const timestamp = new Date().toISOString().replace(/[:]/g, "-");
	const fileName = `envsync-db-preupgrade-${fromVersion || "unknown"}-to-${toVersion}-${timestamp}.dump`;
	const hostPath = path.join(UPGRADE_BACKUPS_ROOT, fileName);
	logStep(`Creating API DB upgrade snapshot ${fileName}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would create upgrade DB snapshot at ${hostPath}`);
		return hostPath;
	}
	ensureDir(UPGRADE_BACKUPS_ROOT);
	run("docker", [
		"run",
		"--rm",
		"--network",
		stackNetworkName(config),
		"-e",
		"PGPASSWORD=envsync-postgres",
		"-v",
		`${UPGRADE_BACKUPS_ROOT}:/backup`,
		"postgres:17",
		"sh",
		"-lc",
		`pg_dump -h ${config.services.stack_name}_postgres -U postgres -d envsync -Fc -f /backup/${fileName}`,
	]);
	logSuccess(`API DB upgrade snapshot created at ${hostPath}`);
	return hostPath;
}

function restoreApiDbUpgradeBackup(config: DeployConfig, backupPath: string) {
	const fileName = path.basename(backupPath);
	logWarn(`Restoring API DB upgrade snapshot ${fileName}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would restore upgrade DB snapshot from ${backupPath}`);
		return;
	}
	run("docker", [
		"run",
		"--rm",
		"--network",
		stackNetworkName(config),
		"-e",
		"PGPASSWORD=envsync-postgres",
		"-v",
		`${UPGRADE_BACKUPS_ROOT}:/backup:ro`,
		"postgres:17",
		"sh",
		"-lc",
		`pg_restore --clean --if-exists --no-owner --no-privileges -h ${config.services.stack_name}_postgres -U postgres -d envsync /backup/${fileName}`,
	]);
	logSuccess(`API DB upgrade snapshot restored from ${backupPath}`);
}

function activateFrontendReleaseForState(config: DeployConfig, state: DeployGeneratedState, fallbackVersion = config.release.version) {
	const version = state.deployment.slots[state.deployment.active_slot].release_version || fallbackVersion;
	activateFrontendRelease("web", version, renderHelpers.renderFrontendRuntimeConfig(config, state));
	if (!isOssConfig(config)) {
		activateFrontendRelease("landing", version, renderHelpers.renderFrontendRuntimeConfig(config, state));
	}
}

function buildKeycloakImage(imageTag: string, repoRoot = REPO_ROOT) {
	const buildContext = path.join(repoRoot, "packages/envsync-keycloak-theme");
	if (!exists(path.join(buildContext, "Dockerfile"))) {
		throw new Error(`Missing Keycloak Docker build context at ${buildContext}`);
	}
	logStep(`Building Keycloak image ${imageTag}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would build ${imageTag} from ${buildContext}`);
		return;
	}
	logCommand("docker", ["build", "-t", imageTag, buildContext]);
	run("docker", ["build", "-t", imageTag, buildContext]);
	logSuccess(`Built Keycloak image ${imageTag}`);
}

function stackNetworkName(config: DeployConfig) {
	return `${config.services.stack_name}_envsync`;
}

function assertSwarmManager() {
	if (currentOptions.dryRun) {
		logDryRun("Skipping Docker Swarm manager validation");
		return;
	}
	logStep("Validating Docker Swarm manager state");
	const state = tryRun("docker", ["info", "--format", "{{.Swarm.LocalNodeState}}|{{.Swarm.ControlAvailable}}"], { quiet: true }).trim();
	if (state !== "active|true") {
		throw new Error("Docker Swarm is not initialized on this node. Run 'docker swarm init' or 'envsync-deploy preinstall' first.");
	}
	logSuccess("Docker Swarm manager is ready");
}

function waitForCommand(
	config: DeployConfig,
	label: string,
	image: string,
	command: string,
	timeoutSeconds = 120,
	env: Record<string, string> = {},
	volumes: string[] = [],
) {
	if (currentOptions.dryRun) {
		logDryRun(`Would wait for ${label}`);
		return;
	}
	logStep(`Waiting for ${label}`);
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		const args = ["run", "--rm", "--network", stackNetworkName(config)];
		for (const volume of volumes) {
			args.push("-v", volume);
		}
		for (const [key, value] of Object.entries(env)) {
			args.push("-e", `${key}=${value}`);
		}
		args.push(image, "sh", "-lc", command);
		if (commandSucceeds("docker", args)) {
			logSuccess(`${label} is ready`);
			return;
		}
		sleepSeconds(2);
	}
	throw new Error(`Timed out waiting for ${label}`);
}

function waitForPostgresService(config: DeployConfig, label: string, host: string, user: string, password: string) {
	waitForCommand(config, `${label} database readiness`, "postgres:17", `pg_isready -h ${host} -U ${user}`, 120, {
		PGPASSWORD: password,
	});
}

function waitForRedisService(config: DeployConfig) {
	waitForCommand(config, "redis readiness", "redis:7", "redis-cli -h redis ping | grep PONG");
}

function waitForTcpService(config: DeployConfig, label: string, host: string, port: number, timeoutSeconds = 120) {
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		if (commandSucceeds(
			"docker",
			["run", "--rm", "--network", stackNetworkName(config), "alpine:3.20", "sh", "-lc", `nc -z -w 2 ${host} ${port}`],
		)) {
			return;
		}
		sleepSeconds(2);
	}
	throw new Error(`Timed out waiting for ${label} at ${host}:${port}`);
}

function waitForHttpService(config: DeployConfig, label: string, url: string, timeoutSeconds = 120) {
	if (currentOptions.dryRun) {
		logDryRun(`Would wait for ${label} at ${url}`);
		return;
	}
	logStep(`Waiting for ${label} on ${url}`);
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		if (
			commandSucceeds("docker", [
				"run",
				"--rm",
				"--network",
				stackNetworkName(config),
				"alpine:3.20",
				"sh",
				"-lc",
				`wget -q -O /dev/null ${JSON.stringify(url)}`,
			])
		) {
			logSuccess(`${label} is ready`);
			return;
		}
		sleepSeconds(2);
	}
	throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function serviceContainerId(config: DeployConfig, serviceName: string) {
	const output = tryRun(
		"docker",
		[
			"ps",
			"--filter",
			`label=com.docker.swarm.service.name=${config.services.stack_name}_${serviceName}`,
			"--format",
			"{{.ID}}",
		],
		{ quiet: true },
	);
	return output
		.split(/\r?\n/)
		.map(line => line.trim())
		.find(Boolean) ?? "";
}

function runOpenFgaMigrate(config: DeployConfig, runtimeEnv: RuntimeEnv) {
	logStep("Running OpenFGA datastore migrations");
	if (currentOptions.dryRun) {
		logDryRun("Would run OpenFGA datastore migrations");
		logCommand("docker", [
			"run",
			"--rm",
			"--network",
			stackNetworkName(config),
			"-e",
			"OPENFGA_DATASTORE_ENGINE=postgres",
			"-e",
			`OPENFGA_DATASTORE_URI=postgres://openfga:${runtimeEnv.OPENFGA_DB_PASSWORD}@openfga_db:5432/openfga?sslmode=disable`,
			"openfga/openfga:v1.12.0",
			"migrate",
		]);
		return;
	}
	run("docker", [
		"run",
		"--rm",
		"--network",
		stackNetworkName(config),
		"-e",
		"OPENFGA_DATASTORE_ENGINE=postgres",
		"-e",
		`OPENFGA_DATASTORE_URI=postgres://openfga:${runtimeEnv.OPENFGA_DB_PASSWORD}@openfga_db:5432/openfga?sslmode=disable`,
		"openfga/openfga:v1.12.0",
		"migrate",
	]);
	logSuccess("OpenFGA datastore migrations completed");
}

function runMiniKmsMigrate(config: DeployConfig, runtimeEnv: RuntimeEnv) {
	logStep("Running miniKMS datastore migrations");
	if (currentOptions.dryRun) {
		logDryRun("Would run miniKMS datastore migrations");
		logCommand("docker", [
			"run",
			"--rm",
			"--network",
			stackNetworkName(config),
			"-e",
			`PGPASSWORD=${runtimeEnv.MINIKMS_DB_PASSWORD}`,
			"-v",
			`${path.join(REPO_ROOT, "docker/minikms/migrations")}:/migrations:ro`,
			"postgres:17",
			"sh",
			"-lc",
			"psql -h minikms_db -U postgres -d minikms -f /migrations/001_initial_schema.sql && psql -h minikms_db -U postgres -d minikms -f /migrations/002_vault_storage.sql",
		]);
		return;
	}
	run("docker", [
		"run",
		"--rm",
		"--network",
		stackNetworkName(config),
		"-e",
		`PGPASSWORD=${runtimeEnv.MINIKMS_DB_PASSWORD}`,
		"-v",
		`${path.join(REPO_ROOT, "docker/minikms/migrations")}:/migrations:ro`,
		"postgres:17",
		"sh",
		"-lc",
		"psql -h minikms_db -U postgres -d minikms -f /migrations/001_initial_schema.sql && psql -h minikms_db -U postgres -d minikms -f /migrations/002_vault_storage.sql",
	]);
	logSuccess("miniKMS datastore migrations completed");
}

function runBootstrapInit(config: DeployConfig) {
	logStep("Running API bootstrap init");
	if (currentOptions.dryRun) {
		logDryRun("Would run API bootstrap init and persist generated OpenFGA IDs");
		logCommand("docker", [
			"run",
			"--rm",
			"--network",
			stackNetworkName(config),
			"--env-file",
			DEPLOY_ENV,
			"-e",
			"SKIP_ROOT_ENV=1",
			"-e",
			"SKIP_ROOT_ENV_WRITE=1",
			config.images.api,
			"bun",
			"run",
			"scripts/prod-init.ts",
			"--json",
			"--skip-migrations",
			"--no-write-root-env",
		]);
		return {
			openfgaStoreId: "",
			openfgaModelId: "",
		};
	}
	const output = run(
		"docker",
		[
			"run",
			"--rm",
			"--network",
			stackNetworkName(config),
			"--env-file",
			DEPLOY_ENV,
			"-e",
			"SKIP_ROOT_ENV=1",
			"-e",
			"SKIP_ROOT_ENV_WRITE=1",
			config.images.api,
			"bun",
			"run",
			"scripts/prod-init.ts",
			"--json",
			"--skip-migrations",
			"--no-write-root-env",
		],
		{ quiet: true },
	).trim();
	const result = parseBootstrapInitJson(output);
	if (!result.openfgaStoreId || !result.openfgaModelId) {
		throw new Error("Bootstrap init did not return OpenFGA IDs");
	}
	logSuccess("API bootstrap init completed");
	return {
		openfgaStoreId: result.openfgaStoreId,
		openfgaModelId: result.openfgaModelId,
	};
}

function parseClickstackBootstrapJson(output: string) {
	const trimmed = output.trim();
	if (!trimmed) {
		throw new Error("ClickStack bootstrap returned no JSON output");
	}

	const lines = trimmed
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const candidate = lines[index]!;
		if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
		try {
			return JSON.parse(candidate) as {
				operatorEmail?: string;
				accessKey?: string;
				browserApiKey?: string;
			};
		} catch {
			continue;
		}
	}

	throw new Error(`ClickStack bootstrap returned non-JSON output.\nCaptured stdout:\n${trimmed}`);
}

function runClickstackBootstrap(config: DeployConfig) {
	logStep("Running ClickStack self-host bootstrap");
	const { generated } = loadState();
	if (currentOptions.dryRun) {
		logDryRun("Would bootstrap ClickStack sources and dashboards");
		logCommand("node", [path.join(REPO_ROOT, "scripts/bootstrap-clickstack-selfhost.mjs")]);
		return {
			browserApiKey: generated.clickstack.browser_api_key,
		};
	}
	const deadline = Date.now() + 180 * 1000;
	let lastError = "unknown error";
	while (Date.now() < deadline) {
		try {
			const output = run("node", [path.join(REPO_ROOT, "scripts/bootstrap-clickstack-selfhost.mjs")], {
				env: {
					ENVSYNC_STACK_NAME: config.services.stack_name,
					ENVSYNC_ROOT_DOMAIN: config.domain.root_domain,
					ENVSYNC_CLICKSTACK_OPERATOR_EMAIL: generated.clickstack.operator_email,
					ENVSYNC_CLICKSTACK_OPERATOR_PASSWORD: generated.clickstack.operator_password,
					ENVSYNC_CLICKSTACK_ACCESS_KEY: generated.clickstack.access_key,
					ENVSYNC_CLICKSTACK_BROWSER_API_KEY: generated.clickstack.browser_api_key,
					ENVSYNC_CLICKSTACK_ALERT_WEBHOOK_URL: config.observability.alert_webhook_url ?? "",
					ENVSYNC_CLICKSTACK_ALERT_WEBHOOK_HEADERS: JSON.stringify(config.observability.alert_webhook_headers ?? {}),
				},
				quiet: true,
			});
			const result = parseClickstackBootstrapJson(output);
			logSuccess("ClickStack self-host bootstrap completed");
			return result;
		} catch (error) {
			lastError = error instanceof Error ? error.message : String(error);
			sleepSeconds(3);
		}
	}
	throw new Error(`Timed out bootstrapping ClickStack: ${lastError}`);
}

function logClickstackCredentials(generated: DeployGeneratedState) {
	logInfo(`ClickStack operator email: ${generated.clickstack.operator_email}`);
	logInfo(`ClickStack operator password: ${generated.clickstack.operator_password}`);
	logInfo(`ClickStack access key: ${generated.clickstack.access_key}`);
	if (generated.clickstack.browser_api_key) {
		logInfo(`ClickStack browser API key: ${generated.clickstack.browser_api_key}`);
	}
}

function parseBootstrapInitJson(output: string) {
	const trimmed = output.trim();
	if (!trimmed) {
		throw new Error("Bootstrap init returned no JSON output");
	}

	try {
		return JSON.parse(trimmed) as { openfgaStoreId?: string; openfgaModelId?: string };
	} catch {
		const lines = trimmed
			.split(/\r?\n/)
			.map(line => line.trim())
			.filter(Boolean);

		for (let index = lines.length - 1; index >= 0; index -= 1) {
			const candidate = lines[index]!;
			if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
			try {
				return JSON.parse(candidate) as { openfgaStoreId?: string; openfgaModelId?: string };
			} catch {
				continue;
			}
		}

		throw new Error(
			`Bootstrap init returned non-JSON output.\nCaptured stdout:\n${trimmed}`,
		);
	}
}

function readRenderedRuntimeConfig(filePath: string) {
	if (!exists(filePath)) return null;
	const raw = fs.readFileSync(filePath, "utf8").trim();
	const prefix = "window.__ENVSYNC_RUNTIME_CONFIG__ = ";
	if (!raw.startsWith(prefix) || !raw.endsWith(";")) return null;
	try {
		return JSON.parse(raw.slice(prefix.length, -1)) as {
			apiBaseUrl?: string;
			appBaseUrl?: string;
			authBaseUrl?: string;
			apiDocsUrl?: string;
			otelEndpoint?: string;
			hyperdxApiKey?: string;
			hyperdxUrl?: string;
			hyperdxDisabled?: boolean;
			releaseVersion?: string;
			activeApiSlot?: ApiSlot;
		};
	} catch {
		return null;
	}
}

function activeApiImage(config: DeployConfig, generated: DeployGeneratedState) {
	const slot = generated.deployment.active_slot;
	return generated.deployment.slots[slot].api_image || config.images.api;
}

function parseMigrationCommandJson(output: string) {
	const trimmed = output.trim();
	if (!trimmed) {
		throw new Error("Migration command returned no JSON output");
	}

	const lines = trimmed
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const candidate = lines[index]!;
		if (!candidate.startsWith("{") || !candidate.endsWith("}")) continue;
		try {
			return JSON.parse(candidate) as {
				ok: boolean;
				currentHead: string | null;
				results?: unknown;
				executedMigrations?: Array<{ name: string; executedAt: string | null }>;
			};
		} catch {
			continue;
		}
	}

	throw new Error(`Migration command returned non-JSON output.\nCaptured stdout:\n${trimmed}`);
}

function runApiMigrationJsonCommand(config: DeployConfig, image: string, args: string[]) {
	if (currentOptions.dryRun) {
		logDryRun(`Would run API migration command in ${image}: ${args.join(" ")}`);
		return {
			ok: true,
			currentHead: null,
			executedMigrations: [],
		};
	}

	const output = run(
		"docker",
		[
			"run",
			"--rm",
			"--network",
			stackNetworkName(config),
			"--env-file",
			DEPLOY_ENV,
			"-e",
			"SKIP_ROOT_ENV=1",
			image,
			"bun",
			"run",
			"scripts/migrate.ts",
			...args,
			"--json",
		],
		{ quiet: true },
	);
	return parseMigrationCommandJson(output);
}

function getApiMigrationHealth(config: DeployConfig, generated: DeployGeneratedState) {
	try {
		const response = runApiMigrationJsonCommand(config, activeApiImage(config, generated), ["head"]);
		return {
			migration_head: response.currentHead,
			auto_migrate_enabled: false,
		};
	} catch (error) {
		return {
			migration_head: null,
			auto_migrate_enabled: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function resolveClickstackContainerId(config: DeployConfig) {
	const output = tryRun(
		"docker",
		[
			"ps",
			"--filter",
			`label=com.docker.swarm.service.name=${config.services.stack_name}_clickstack`,
			"--format",
			"{{.ID}}",
		],
		{ quiet: true },
	).trim();
	return output.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? "";
}

function runClickstackMongoJson<T>(config: DeployConfig, script: string): T | null {
	const containerId = resolveClickstackContainerId(config);
	if (!containerId) return null;
	try {
		const payload = Buffer.from(script, "utf8").toString("base64");
		const output = run(
			"docker",
			[
				"exec",
				"-e",
				`HDX_SCRIPT=${payload}`,
				containerId,
				"sh",
				"-lc",
				"printf '%s' \"$HDX_SCRIPT\" | base64 -d >/tmp/envsync-clickstack-health.js && mongo hyperdx --quiet /tmp/envsync-clickstack-health.js",
			],
			{ quiet: true },
		).trim();
		const parsed = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).at(-1);
		if (!parsed) return null;
		return JSON.parse(parsed) as T;
	} catch {
		return null;
	}
}

function getClickstackSearchState(config: DeployConfig) {
	return runClickstackMongoJson<{
		sourceNames: string[];
		savedSearches: Array<{ name: string; tags?: string[] }>;
		dashboardTags: string[];
	}>(config, `
var team = db.teams.findOne({ name: ${JSON.stringify(CLICKSTACK_SELFHOST_TEAM_NAME)} });
if (!team) {
  print(JSON.stringify({ sourceNames: [], savedSearches: [], dashboardTags: [] }));
  quit();
}

var sourceNames = db.sources.find({ team: team._id }, { name: 1 }).toArray().map(function(source) {
  return source.name;
}).filter(Boolean);

var savedSearches = db.savedsearches.find({ team: team._id }, { name: 1, tags: 1 }).toArray().map(function(search) {
  return {
    name: search.name,
    tags: Array.isArray(search.tags) ? search.tags : []
  };
}).filter(function(search) {
  return Boolean(search.name);
});

var dashboardTags = [];
db.dashboards.find({ team: team._id }, { tags: 1 }).toArray().forEach(function(dashboard) {
  if (Array.isArray(dashboard.tags)) {
    dashboard.tags.forEach(function(tag) {
      dashboardTags.push(tag);
    });
  }
});

print(JSON.stringify({
  sourceNames: sourceNames,
  savedSearches: savedSearches,
  dashboardTags: dashboardTags
}));
`);
}

function hasCompleteBootstrapState(generated: DeployGeneratedState) {
	return REQUIRED_BOOTSTRAP_ENV_KEYS.every(key => {
		switch (key) {
			case "S3_SECRET_KEY":
				return generated.secrets.s3_secret_key.length > 0;
			case "KEYCLOAK_WEB_CLIENT_SECRET":
				return generated.secrets.keycloak_web_client_secret.length > 0;
			case "KEYCLOAK_API_CLIENT_SECRET":
				return generated.secrets.keycloak_api_client_secret.length > 0;
			case "OPENFGA_DB_PASSWORD":
				return generated.secrets.openfga_db_password.length > 0;
			case "MINIKMS_ROOT_KEY":
				return generated.secrets.minikms_root_key.length > 0;
			case "MINIKMS_DB_PASSWORD":
				return generated.secrets.minikms_db_password.length > 0;
			case "OPENFGA_STORE_ID":
				return generated.openfga.store_id.length > 0;
			case "OPENFGA_MODEL_ID":
				return generated.openfga.model_id.length > 0;
			default:
				return false;
		}
	});
}

function assertBootstrapState(generated: DeployGeneratedState) {
	if (!hasCompleteBootstrapState(generated)) {
		throw new Error("Missing bootstrap state. Run 'envsync-deploy bootstrap' first.");
	}
}

function parseReplicaHealth(raw: string): ServiceHealth {
	const match = raw.match(/^(\d+)\/(\d+)$/);
	if (!match) return raw.trim() ? "degraded" : "missing";
	const current = Number(match[1]);
	const desired = Number(match[2]);
	if (desired === 0) return "missing";
	if (current === desired) return "healthy";
	return "degraded";
}

function listStackServices(config: DeployConfig) {
	const output = tryRun(
		"docker",
		["stack", "services", config.services.stack_name, "--format", "{{.Name}}|{{.Replicas}}"],
		{ quiet: true },
	);
	const services = new Map<string, ServiceHealth>();
	for (const line of output.split(/\r?\n/)) {
		if (!line.trim()) continue;
		const [name, replicas] = line.split("|");
		services.set(name, parseReplicaHealth(replicas ?? ""));
	}
	return services;
}

function listManagedContainers(config: DeployConfig) {
	const output = tryRun("docker", ["ps", "-aq", "--filter", `name=^/${config.services.stack_name}_`], { quiet: true });
	return output
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
}

function stackExists(config: DeployConfig) {
	const output = tryRun("docker", ["stack", "ls", "--format", "{{.Name}}"], { quiet: true });
	return output
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean)
		.includes(config.services.stack_name);
}

function waitForStackRemoval(config: DeployConfig, timeoutSeconds = 60) {
	if (currentOptions.dryRun) {
		logDryRun(`Would wait for stack ${config.services.stack_name} to be removed`);
		return;
	}
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		if (!stackExists(config)) {
			return;
		}
		sleepSeconds(2);
	}
	throw new Error(`Timed out waiting for stack ${config.services.stack_name} to be removed`);
}

async function confirmBootstrapReset(config: DeployConfig) {
	const volumeNames = STACK_VOLUMES.map(volume => stackVolumeName(config, volume));
	const containerIds = listManagedContainers(config);
	const networkName = stackNetworkName(config);
	logWarn("Bootstrap will delete existing EnvSync Docker resources before rebuilding infra.");
	logWarn(`Stack: ${config.services.stack_name}`);
	logWarn(`Network: ${networkName}`);
	logWarn(`Volumes: ${volumeNames.join(", ")}`);
	if (containerIds.length > 0) {
		logWarn(`Containers: ${containerIds.join(", ")}`);
	} else {
		logWarn("Containers: none currently matched");
	}
	logWarn("This removes existing deployment data for the managed EnvSync services.");
	if (currentOptions.force) {
		logWarn("Skipping confirmation because --force was provided.");
		logSuccess("Destructive bootstrap reset confirmed");
		return;
	}
	const response = await askRequired(chalk.bold.red('Type "yes" to continue:'), "Bootstrap");
	if (response !== "yes") {
		throw new Error("Bootstrap aborted. Confirmation did not match 'yes'.");
	}
	logSuccess("Destructive bootstrap reset confirmed");
}

function loadConfigForCleanup() {
	if (!exists(DEPLOY_YAML)) {
		logWarn(`No deploy config found at ${DEPLOY_YAML}; managed runtime cleanup will be skipped.`);
		return null;
	}
	try {
		return loadConfig();
	} catch (error) {
		logWarn(`Deploy config at ${DEPLOY_YAML} is unreadable and managed runtime cleanup will be skipped: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}

async function confirmRemove(config: DeployConfig | null) {
	logWarn("Remove will delete local EnvSync deployment artifacts and managed Docker resources.");
	logWarn(`Targets: ${REMOVE_TARGETS.join(", ")}`);
	if (config) {
		const stackName = config.services.stack_name;
		const networkName = stackNetworkName(config);
		const volumeNames = STACK_VOLUMES.map(volume => stackVolumeName(config, volume));
		logWarn(`Stack: ${stackName}`);
		logWarn(`Network: ${networkName}`);
		logWarn(`Volumes: ${volumeNames.join(", ")}`);
	}
	if (currentOptions.force) {
		logWarn("Skipping confirmation because --force was provided.");
		logSuccess("Destructive remove confirmed");
		return;
	}
	const response = await askRequired(chalk.bold.red(`Type "${REMOVE_CONFIRMATION_TOKEN}" to continue:`), "Remove");
	if (response !== REMOVE_CONFIRMATION_TOKEN) {
		throw new Error(`Remove aborted. Confirmation did not match '${REMOVE_CONFIRMATION_TOKEN}'.`);
	}
	logSuccess("Destructive remove confirmed");
}

function removeTarget(target: string) {
	if (!exists(target)) return;
	if (currentOptions.dryRun) {
		logDryRun(`Would remove ${target}`);
		return;
	}
	fs.rmSync(target, { recursive: true, force: true });
	logInfo(`Removed ${target}`);
}

async function cmdRemove() {
	logSection("Remove");
	const config = loadConfigForCleanup();
	await confirmRemove(config);
	if (config) {
		cleanupBootstrapState(config);
	}
	for (const target of REMOVE_TARGETS) {
		removeTarget(target);
	}
	logSuccess("Remove completed");
}

function cleanupBootstrapState(config: DeployConfig) {
	const volumeNames = STACK_VOLUMES.map(volume => stackVolumeName(config, volume));
	const containerIds = listManagedContainers(config);
	const networkName = stackNetworkName(config);

	logStep("Removing existing EnvSync deployment resources");
	if (currentOptions.dryRun) {
		if (stackExists(config)) {
			logDryRun(`Would remove stack ${config.services.stack_name}`);
			logCommand("docker", ["stack", "rm", config.services.stack_name]);
		} else {
			logDryRun(`No existing stack named ${config.services.stack_name} found`);
		}
		if (containerIds.length > 0) {
			logDryRun(`Would remove containers: ${containerIds.join(", ")}`);
			logCommand("docker", ["rm", "-f", ...containerIds]);
		}
		logDryRun(`Would remove network ${networkName} if present`);
		logCommand("docker", ["network", "rm", networkName]);
		for (const volumeName of volumeNames) {
			logDryRun(`Would remove volume ${volumeName}`);
			logCommand("docker", ["volume", "rm", "-f", volumeName]);
		}
		logSuccess("Bootstrap cleanup preview completed");
		return;
	}

	if (stackExists(config)) {
		logCommand("docker", ["stack", "rm", config.services.stack_name]);
		run("docker", ["stack", "rm", config.services.stack_name]);
		waitForStackRemoval(config);
	}

	const refreshedContainers = listManagedContainers(config);
	if (refreshedContainers.length > 0) {
		logCommand("docker", ["rm", "-f", ...refreshedContainers]);
		const removed = runIgnoringAbsent("docker", ["rm", "-f", ...refreshedContainers], {
			absentPatterns: ["no such container", "not found"],
		});
		if (!removed) {
			logInfo("Managed containers were already absent");
		}
	}

	if (commandSucceeds("docker", ["network", "inspect", networkName])) {
		logCommand("docker", ["network", "rm", networkName]);
		const removed = runIgnoringAbsent("docker", ["network", "rm", networkName], {
			absentPatterns: ["network", "not found", "no such network"],
		});
		if (!removed) {
			logInfo(`Network ${networkName} was already absent`);
		}
	}

	for (const volumeName of volumeNames) {
		if (commandSucceeds("docker", ["volume", "inspect", volumeName])) {
			logCommand("docker", ["volume", "rm", "-f", volumeName]);
			const removed = runIgnoringAbsent("docker", ["volume", "rm", "-f", volumeName], {
				absentPatterns: ["no such volume", "not found"],
			});
			if (!removed) {
				logInfo(`Volume ${volumeName} was already absent`);
			}
		}
	}

	logSuccess("Existing EnvSync deployment resources removed");
}

function serviceHealth(services: Map<string, ServiceHealth>, name: string) {
	return services.get(`${name}`) ?? "missing";
}

function apiHealth(services: Map<string, ServiceHealth>, stackName: string): ServiceHealth {
	const blue = serviceHealth(services, `${stackName}_envsync_api_blue`);
	const green = serviceHealth(services, `${stackName}_envsync_api_green`);
	if (blue === "missing" && green === "missing") return "missing";
	if (blue === "healthy" || green === "healthy") return "healthy";
	return "degraded";
}

function waitForApiSlotHealthy(config: DeployConfig, slot: ApiSlot, timeoutSeconds = 180) {
	if (currentOptions.dryRun) {
		logDryRun(`Would wait for API ${slot} slot readiness`);
		return;
	}
	const deadline = Date.now() + timeoutSeconds * 1000;
	const serviceName = slotStackServiceName(config, slot);
	while (Date.now() < deadline) {
		const services = listStackServices(config);
		if (serviceHealth(services, serviceName) === "healthy") {
			logSuccess(`API ${slot} slot is healthy`);
			return;
		}
		sleepSeconds(3);
	}
	const services = listStackServices(config);
	throw new Error(`Timed out waiting for API ${slot} slot to become healthy: ${serviceHealth(services, serviceName)}`);
}

function waitForHealthyServices(
	config: DeployConfig,
	checks: Array<{ label: string; getHealth: (services: Map<string, ServiceHealth>) => ServiceHealth }>,
	timeoutSeconds = 180,
) {
	if (currentOptions.dryRun) {
		logDryRun(`Would wait for ${checks.map(check => check.label).join(", ")} service readiness`);
		return;
	}
	const deadline = Date.now() + timeoutSeconds * 1000;
	while (Date.now() < deadline) {
		const services = listStackServices(config);
		const pending = checks.filter(check => check.getHealth(services) !== "healthy");
		if (pending.length === 0) {
			return;
		}
		sleepSeconds(3);
	}
	const services = listStackServices(config);
	const pending = checks
		.map(check => `${check.label}=${check.getHealth(services)}`)
		.join(", ");
	throw new Error(`Timed out waiting for deployed services to become healthy: ${pending}`);
}

function deployRenderedStack(config: DeployConfig, label: string) {
	if (currentOptions.dryRun) {
		logDryRun(`Would deploy ${label} stack for ${config.services.stack_name}`);
		logCommand("docker", ["stack", "deploy", "-c", STACK_FILE, config.services.stack_name]);
		return;
	}
	logStep(`Deploying ${label} stack`);
	logCommand("docker", ["stack", "deploy", "-c", STACK_FILE, config.services.stack_name]);
	for (let attempt = 1; attempt <= 5; attempt += 1) {
		const result = spawnSync("docker", ["stack", "deploy", "-c", STACK_FILE, config.services.stack_name], {
			env: process.env,
			stdio: "pipe",
			encoding: "utf8",
		});
		const stdout = typeof result.stdout === "string" ? result.stdout.trim() : "";
		const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";
		if (stdout) console.log(stdout);
		if (stderr) console.error(stderr);
		if (result.status === 0) {
			logSuccess(`${label} stack deployed`);
			return;
		}
		const combined = `${stdout}\n${stderr}`.toLowerCase();
		if (attempt < 5 && combined.includes("update out of sequence")) {
			logWarn(`Swarm reported an out-of-sequence service update while deploying ${label}; retrying (${attempt}/5)`);
			sleepSeconds(3);
			continue;
		}
		throw new Error(`Command failed: docker stack deploy -c ${STACK_FILE} ${config.services.stack_name}${stderr ? `\n${stderr}` : ""}`);
	}
}

function persistGeneratedState(config: DeployConfig, generated: DeployGeneratedState) {
	if (currentOptions.dryRun) {
		logDryRun("Would persist generated deployment state");
		return;
	}
	writeDeployArtifacts(config, generated);
}

function formatHealthStatus(status: ServiceHealth | boolean) {
	if (status === true || status === "healthy") {
		return `${chalk.green("●")} ${chalk.green(typeof status === "boolean" ? "yes" : status)}`;
	}
	if (status === false || status === "missing") {
		return `${chalk.red("●")} ${chalk.red(typeof status === "boolean" ? "no" : status)}`;
	}
	return `${chalk.yellow("●")} ${chalk.yellow(status)}`;
}

function printHealthLine(label: string, value: string) {
	console.log(`  ${chalk.dim(label.padEnd(22))} ${value}`);
}

function printHealthSection(title: string) {
	console.log(`\n${chalk.bold.blue(title)}`);
}

function printHealthSummary(checks: {
	edition: "oss" | "enterprise";
	bootstrap: {
		completed: boolean;
		completed_at: string | null;
		services: Record<string, ServiceHealth>;
	};
	deploy: {
		active_slot: ApiSlot;
		previous_slot: string | null;
		maintenance_mode: boolean;
		api: ServiceHealth;
		api_slots: Record<ApiSlot, {
			service: ServiceHealth;
			image: string | null;
			release_version: string | null;
			deployed_at: string | null;
			active: boolean;
		}>;
		web: ServiceHealth;
		landing: ServiceHealth;
	};
	database: {
		api: {
			migration_head: string | null;
			auto_migrate_enabled: boolean;
			error?: string;
		};
	};
	observability: {
		service: ServiceHealth;
		obs_ui: { url: string; configured: boolean };
		obs_api: { url: string; configured: boolean };
		obs_otlp: { url: string; configured: boolean };
		frontend_otel_endpoint: { web: string; landing: string };
		browser_replay_runtime: {
			web: { configured: boolean; hyperdx_url: string | null };
			landing: { configured: boolean; hyperdx_url: string | null };
		};
		sessions_source: { configured: boolean };
		saved_searches: { configured: boolean; missing: string[] };
		tags: { configured: boolean; missing: string[] };
	};
	public: Record<string, string>;
	frontend_runtime: {
		web: {
			api_base_url: string | null;
			app_base_url: string | null;
			auth_base_url: string | null;
			api_docs_url: string | null;
			release_version: string | null;
			active_api_slot: string | null;
		};
		landing: {
			api_base_url: string | null;
			app_base_url: string | null;
			auth_base_url: string | null;
			api_docs_url: string | null;
			release_version: string | null;
			active_api_slot: string | null;
		};
	};
}) {
	printHealthSection("EnvSync Health");
	printHealthLine("Bootstrap", formatHealthStatus(checks.bootstrap.completed));
	printHealthLine("Deploy API", formatHealthStatus(checks.deploy.api));
	printHealthLine("Web", formatHealthStatus(checks.deploy.web));
	printHealthLine("Landing", formatHealthStatus(checks.deploy.landing));
	printHealthLine("ClickStack", formatHealthStatus(checks.observability.service));
	printHealthLine("Active slot", chalk.cyan(checks.deploy.active_slot));
	printHealthLine("Maintenance mode", checks.deploy.maintenance_mode ? chalk.yellow("enabled") : chalk.green("disabled"));
	if (checks.deploy.previous_slot) {
		printHealthLine("Rollback slot", chalk.yellow(checks.deploy.previous_slot));
	}

	printHealthSection("Bootstrap");
	printHealthLine("Completed", formatHealthStatus(checks.bootstrap.completed));
	printHealthLine("Completed at", checks.bootstrap.completed_at ?? chalk.dim("not completed"));
	for (const [service, health] of Object.entries(checks.bootstrap.services)) {
		printHealthLine(service, formatHealthStatus(health));
	}

	printHealthSection("Deployment");
	for (const [slot, data] of Object.entries(checks.deploy.api_slots)) {
		const heading = `${slot}${data.active ? " (active)" : ""}`;
		printHealthLine(heading, formatHealthStatus(data.service));
		if (data.release_version) printHealthLine(`${slot} release`, `v${data.release_version}`);
		if (data.image) printHealthLine(`${slot} image`, chalk.dim(data.image));
		if (data.deployed_at) printHealthLine(`${slot} deployed`, data.deployed_at);
	}

	printHealthSection("Database");
	printHealthLine("API migration head", checks.database.api.migration_head ?? chalk.dim("none"));
	printHealthLine("DB auto migrate", checks.database.api.auto_migrate_enabled ? chalk.red("enabled") : chalk.green("disabled"));
	if (checks.database.api.error) {
		printHealthLine("Migration probe", chalk.yellow(checks.database.api.error));
	}

	printHealthSection("Observability");
	printHealthLine("Sessions source", formatHealthStatus(checks.observability.sessions_source.configured));
	printHealthLine("Saved searches", formatHealthStatus(checks.observability.saved_searches.configured));
	if (checks.observability.saved_searches.missing.length > 0) {
		printHealthLine("Missing searches", chalk.yellow(checks.observability.saved_searches.missing.join(", ")));
	}
	printHealthLine("Tags", formatHealthStatus(checks.observability.tags.configured));
	if (checks.observability.tags.missing.length > 0) {
		printHealthLine("Missing tags", chalk.yellow(checks.observability.tags.missing.join(", ")));
	}
	printHealthLine("Replay web", formatHealthStatus(checks.observability.browser_replay_runtime.web.configured));
	printHealthLine("Replay landing", formatHealthStatus(checks.observability.browser_replay_runtime.landing.configured));
	printHealthLine("Obs UI", checks.observability.obs_ui.url);
	printHealthLine("Obs API", checks.observability.obs_api.url);
	printHealthLine("Obs OTLP", checks.observability.obs_otlp.url);

	printHealthSection("Frontend Runtime");
	printHealthLine("Web API", checks.frontend_runtime.web.api_base_url ?? chalk.dim("missing"));
	printHealthLine("Web App", checks.frontend_runtime.web.app_base_url ?? chalk.dim("missing"));
	printHealthLine("Web Auth", checks.frontend_runtime.web.auth_base_url ?? chalk.dim("missing"));
	printHealthLine("Web Docs", checks.frontend_runtime.web.api_docs_url ?? chalk.dim("missing"));
	if (checks.frontend_runtime.web.release_version) {
		printHealthLine("Web Release", `v${checks.frontend_runtime.web.release_version}`);
	}
	if (checks.frontend_runtime.web.active_api_slot) {
		printHealthLine("Web Slot", checks.frontend_runtime.web.active_api_slot);
	}
	printHealthLine("Landing API", checks.frontend_runtime.landing.api_base_url ?? chalk.dim("missing"));
	printHealthLine("Landing App", checks.frontend_runtime.landing.app_base_url ?? chalk.dim("missing"));
	printHealthLine("Landing Auth", checks.frontend_runtime.landing.auth_base_url ?? chalk.dim("missing"));
	printHealthLine("Landing Docs", checks.frontend_runtime.landing.api_docs_url ?? chalk.dim("missing"));
	if (checks.frontend_runtime.landing.release_version) {
		printHealthLine("Landing Release", `v${checks.frontend_runtime.landing.release_version}`);
	}
	if (checks.frontend_runtime.landing.active_api_slot) {
		printHealthLine("Landing Slot", checks.frontend_runtime.landing.active_api_slot);
	}

	printHealthSection("Public URLs");
	for (const [label, url] of Object.entries(checks.public)) {
		printHealthLine(label, url);
	}

	printHealthSection("Next Steps");
	if (!checks.bootstrap.completed) {
		printHealthLine("Recommended", chalk.cyan("envsync-deploy bootstrap"));
		return;
	}
	if (checks.deploy.api !== "healthy" || checks.deploy.web !== "healthy" || (checks.edition !== "oss" && checks.deploy.landing !== "healthy")) {
		printHealthLine("Recommended", chalk.cyan("envsync-deploy deploy"));
		return;
	}
	printHealthLine("Inspect JSON", chalk.cyan("envsync-deploy health --json"));
	printHealthLine("Upgrade", chalk.cyan("envsync-deploy upgrade"));
	printHealthLine("Backup", chalk.cyan("envsync-deploy backup"));
}

async function cmdPreinstall() {
	ensureDir(HOST_ROOT);
	ensureDir(DEPLOY_ROOT);
	ensureDir(RELEASES_ROOT);
	ensureDir(BACKUPS_ROOT);
	ensureDir(ETC_ROOT);
	ensureDir(LICENSE_ROOT);
	ensureDir(TRAEFIK_STATE_ROOT);
	run("bash", ["-lc", "command -v apt-get >/dev/null"]);
	run("sudo", ["apt-get", "update"]);
	run("sudo", [
		"apt-get",
		"install",
		"-y",
		"docker.io",
		"docker-compose-v2",
		"git",
		"curl",
		"jq",
		"openssl",
		"tar",
		"wireguard-tools",
	]);
	run("sudo", ["systemctl", "enable", "--now", "docker"]);
	try {
		run("docker", ["swarm", "init"]);
	} catch {
	}
	run("docker", ["buildx", "version"]);
	run("bash", ["-lc", "curl -fsSL https://ghcr.io >/dev/null"]);
	run("bash", ["-lc", "curl -fsSL https://acme-v02.api.letsencrypt.org/directory >/dev/null"]);
}

async function cmdSetup() {
	logSection("Setup");
	const rootDomain = await ask("Root domain", "example.com");
	const acmeEmail = await ask("ACME email", `admin@${rootDomain}`);
	const releaseVersion = await ask("Release version", getDeployCliVersion());
	assertSemverVersion(releaseVersion, "release version");
	const releaseImages = versionedImages(releaseVersion);
	const adminUser = await ask("Keycloak admin user", "admin");
	const adminPassword = await ask("Keycloak admin password", randomSecret(12));
	const smtpHost = await ask("SMTP host", "smtp.example.com");
	const smtpPort = Number(await ask("SMTP port", "587"));
	const smtpSecure = (await ask("SMTP secure (true/false)", "true")) === "true";
	const smtpUser = await ask("SMTP user", "");
	const smtpPass = await ask("SMTP pass", "");
	const smtpFrom = await ask("SMTP from", `noreply@${rootDomain}`);
	const retentionDays = Number(await ask("ClickStack retention days", "30"));
	const publicAuth = (await ask("Expose auth.<domain> publicly (true/false)", "true")) === "true";
	const publicObs = (await ask("Expose obs.<domain> publicly (true/false)", "true")) === "true";
	const mailpitEnabled = (await ask("Enable mailpit (true/false)", "false")) === "true";
	const netutilsEnabled = (await ask("Enable WireGuard jump host access (true/false)", "false")) === "true";
	const netutilsExposeAll = netutilsEnabled
		? (await ask("Expose all EnvSync service ports over WireGuard (true/false)", "false")) === "true"
		: false;
	let netutilsForwards = [] as Array<{ service: string; service_port: number; host_port: number; protocol: "tcp" | "udp" }>;
	if (netutilsEnabled) {
		if (netutilsExposeAll) {
			netutilsForwards = buildNetutilsExposeAllForwards("envsync");
			logInfo("Netutils exposes all preset (auto-generated):");
			for (const forward of netutilsForwards) {
				console.log(`  ${forward.service}:${forward.service_port} -> ${forward.host_port} (${forward.protocol})`);
			}
		} else {
			netutilsForwards = parseNetutilsForwardsFromInput(
				await ask(
					"Netutils forwards (format service:service_port:host_port[:protocol], comma-separated)",
					"postgres:5432:15432:tcp,keycloak:8080:18080:tcp",
				),
				"envsync",
			);
		}
	}
	const licenseServerUrl = await ask("Enterprise license server URL", DEFAULT_ENTERPRISE_LICENSE_SERVER_URL);
	const vpnProvider = (await ask("VPN provider for internal service access (netbird/none)", "none")).toLowerCase() as "netbird" | "none";
	let vpnInternalDomain = "envsync.local";
	let vpnNbSetupKey = "";
	if (vpnProvider !== "none") {
		vpnInternalDomain = await ask("Internal root domain", "envsync.local");
		vpnNbSetupKey = await ask("Netbird setup key", "");
	}
	const licenseKey = licenseServerUrl ? await ask("Enterprise license key", "") : "";
	const certificateBundleFile = licenseServerUrl ? "" : await ask("Enterprise certificate bundle file (optional)", "");
	const installFingerprint = deterministicInstallFingerprint(rootDomain, "envsync");

	const config: DeployConfig = {
		edition: "enterprise",
		source: defaultSourceConfig(releaseVersion),
		release: {
			version: releaseVersion,
		},
		domain: { root_domain: rootDomain, acme_email: acmeEmail },
		images: {
			api: releaseImages.api,
			management_api: releaseImages.management_api,
			keycloak: releaseImages.keycloak,
			web: releaseImages.web,
			landing: releaseImages.landing,
			clickstack: "clickhouse/clickstack-all-in-one:latest",
			traefik: "traefik:v3.6.6",
			otel_agent: "otel/opentelemetry-collector-contrib:0.111.0",
		},
		services: {
			stack_name: "envsync",
			api_port: 4000,
			management_api_port: 4001,
			public_http_port: 80,
			public_https_port: 443,
			clickstack_ui_port: 8080,
			clickstack_otlp_http_port: 4318,
			clickstack_otlp_grpc_port: 4317,
			keycloak_port: 8080,
			rustfs_port: 9000,
			rustfs_console_port: 9001,
		},
		auth: {
			keycloak_realm: "envsync",
			admin_user: adminUser,
			admin_password: adminPassword,
			web_client_id: "envsync-web",
			api_client_id: "envsync-api",
			cli_client_id: "envsync-cli",
		},
		observability: {
			retention_days: retentionDays,
			public_obs: publicObs,
		},
		backup: {
			output_dir: BACKUPS_ROOT,
			encrypted: true,
		},
		smtp: {
			host: smtpHost,
			port: smtpPort,
			secure: smtpSecure,
			user: smtpUser,
			pass: smtpPass,
			from: smtpFrom,
		},
		exposure: {
			public_auth: publicAuth,
			public_obs: publicObs,
			mailpit_enabled: mailpitEnabled,
			s3_public: true,
			s3_console_public: true,
		},
		upgrade: {
			maintenance_mode_enabled: true,
			db_snapshot_on_api_upgrade: true,
			keep_failed_upgrade_db_snapshot: true,
		},
		license: {
			server_url: licenseServerUrl || undefined,
			key: licenseKey || undefined,
			install_fingerprint: installFingerprint,
			certificate_bundle_file: certificateBundleFile || undefined,
			certificate_validity_days: 1095,
		},
		netutils: {
			enabled: netutilsEnabled,
			forwards: netutilsForwards,
		},
		vpn: {
			provider: vpnProvider,
			internal_domain: vpnInternalDomain,
			nb_setup_key: vpnNbSetupKey,
		},
	};

	saveDesiredConfig(config);
	logSuccess(`Config written to ${DEPLOY_YAML}`);
	logInfo(`Pinned source checkout: ${config.source.repo_url} @ ${config.source.ref}`);
	logInfo("Create these DNS records:");
	console.log(JSON.stringify(domainMap(rootDomain), null, 2));
}

async function cmdBootstrap() {
	logSection("Bootstrap");
	const { config, generated } = loadState();
	const nextGenerated = ensureGeneratedRuntimeState(config, resetBootstrapGeneratedState(generated));
	const runtimeEnv = renderHelpers.buildRuntimeEnv(config, nextGenerated);
	logReleaseContext(config);
	assertSwarmManager();
	await ensureEnterpriseCertificateBundle(config);
	if (currentOptions.dryRun) {
		logWarn("Dry-run mode: bootstrap reset will be previewed but not executed.");
	}
	await confirmBootstrapReset(config);
	cleanupBootstrapState(config);
	ensureRepoCheckout(config);
	writeDeployArtifacts(config, nextGenerated);
	buildKeycloakImage(config.images.keycloak);
	if (currentOptions.dryRun) {
		logDryRun(`Would deploy base bootstrap stack for ${config.services.stack_name}`);
		logCommand("docker", ["stack", "deploy", "-c", BOOTSTRAP_BASE_STACK_FILE, config.services.stack_name]);
	} else {
		logStep("Deploying base bootstrap stack");
		logCommand("docker", ["stack", "deploy", "-c", BOOTSTRAP_BASE_STACK_FILE, config.services.stack_name]);
		run("docker", ["stack", "deploy", "-c", BOOTSTRAP_BASE_STACK_FILE, config.services.stack_name]);
		logSuccess("Base bootstrap stack deployed");
	}
	waitForPostgresService(config, "postgres", "postgres", "postgres", "envsync-postgres");
	waitForRedisService(config);
	waitForTcpService(config, "rustfs", "rustfs", 9000);
	waitForPostgresService(config, "keycloak", "keycloak_db", "keycloak", runtimeEnv.KEYCLOAK_DB_PASSWORD);
	waitForPostgresService(config, "openfga", "openfga_db", "openfga", runtimeEnv.OPENFGA_DB_PASSWORD);
	waitForPostgresService(config, "minikms", "minikms_db", "postgres", runtimeEnv.MINIKMS_DB_PASSWORD);
	runOpenFgaMigrate(config, runtimeEnv);
	runMiniKmsMigrate(config, runtimeEnv);
	if (currentOptions.dryRun) {
		logDryRun(`Would deploy runtime bootstrap stack for ${config.services.stack_name}`);
		logCommand("docker", ["stack", "deploy", "-c", BOOTSTRAP_STACK_FILE, config.services.stack_name]);
	} else {
		logStep("Deploying runtime bootstrap stack");
		logCommand("docker", ["stack", "deploy", "-c", BOOTSTRAP_STACK_FILE, config.services.stack_name]);
		run("docker", ["stack", "deploy", "-c", BOOTSTRAP_STACK_FILE, config.services.stack_name]);
		logSuccess("Runtime bootstrap stack deployed");
	}
	waitForHttpService(config, "keycloak management readiness", "http://keycloak:9000/health/ready", 180);
	waitForHttpService(config, "openfga", "http://openfga:8090/stores");
	waitForTcpService(config, "minikms", "minikms", 50051);
	logStep("Running API database migrations");
	runApiMigrationJsonCommand(config, config.images.api, ["latest"]);
	logSuccess("API database migrations completed");
	const initResult = runBootstrapInit(config);
	const clickstackBootstrapResult = runClickstackBootstrap(config);
	const persistedGenerated = normalizeGeneratedState({
		openfga: {
			store_id: initResult.openfgaStoreId,
			model_id: initResult.openfgaModelId,
		},
		deployment: nextGenerated.deployment,
		clickstack: {
			...nextGenerated.clickstack,
			browser_api_key: clickstackBootstrapResult.browserApiKey ?? nextGenerated.clickstack.browser_api_key,
		},
		secrets: nextGenerated.secrets,
		bootstrap: nextGenerated.bootstrap,
	});
	if (!currentOptions.dryRun) {
		writeDeployArtifacts(config, persistedGenerated);
	}
	if (currentOptions.dryRun) {
		logDryRun("Skipping generated OpenFGA ID persistence in preview mode");
		logSuccess("Bootstrap dry-run completed");
		return;
	}
	const bootstrappedGenerated = normalizeGeneratedState({
		openfga: {
			store_id: initResult.openfgaStoreId,
			model_id: initResult.openfgaModelId,
		},
		deployment: nextGenerated.deployment,
		clickstack: persistedGenerated.clickstack,
		secrets: nextGenerated.secrets,
		bootstrap: {
			completed_at: new Date().toISOString(),
		},
	});
	writeDeployArtifacts(config, bootstrappedGenerated);
	logClickstackCredentials(bootstrappedGenerated);
	logSuccess("Bootstrap completed");
}

async function cmdDeploy() {
	logSection("Deploy");
	const { config, generated } = loadState();
	logReleaseContext(config);
	if (!isOssConfig(config)) {
		ensureEnterpriseLicenseFilesReadable();
	}
	assertSwarmManager();
	assertBootstrapState(generated);
	if (!currentOptions.dryRun) {
		const services = listStackServices(config);
		if (
			serviceHealth(services, `${config.services.stack_name}_keycloak`) === "missing" ||
			serviceHealth(services, `${config.services.stack_name}_openfga`) === "missing" ||
			serviceHealth(services, `${config.services.stack_name}_minikms`) === "missing"
		) {
			logWarn("Bootstrap services are not running. Recreating from persisted bootstrap state.");
		}
	} else {
		logDryRun("Skipping runtime bootstrap service validation");
	}
	ensureRepoCheckout(config);
	buildKeycloakImage(config.images.keycloak);
	if (!currentOptions.dryRun) {
		ensureDir(currentReleaseDir("web"));
		if (!isOssConfig(config)) {
			ensureDir(currentReleaseDir("landing"));
		}
	}
	stageFrontendRelease("web", config.images.web, config.release.version);
	if (!isOssConfig(config)) {
		stageFrontendRelease("landing", config.images.landing, config.release.version);
	}

	const originalState = normalizeGeneratedState(generated);
	let currentState = originalState;
	let promoted = false;
	const candidateDeployment = createPromotionCandidateState(config, currentState);
	if (candidateDeployment) {
		const targetSlot = otherApiSlot(candidateDeployment.active_slot);
		const candidateState = normalizeGeneratedState({
			...currentState,
			deployment: {
				...candidateDeployment,
				maintenance_mode: config.upgrade.maintenance_mode_enabled,
			},
		});
		const activeImageBeforeUpgrade = currentState.deployment.slots[currentState.deployment.active_slot].api_image || config.images.api;
		const activeReleaseBeforeUpgrade = currentState.deployment.slots[currentState.deployment.active_slot].release_version || config.release.version;
		const preUpgradeHead = runApiMigrationJsonCommand(config, activeImageBeforeUpgrade, ["head"]).currentHead;
		let snapshotPath: string | null = null;
		let usedSnapshotRestore = false;
		writeDeployArtifacts(config, candidateState);
		try {
			logInfo(`Deploying release ${config.release.version} into inactive API slot ${targetSlot}`);
			deployRenderedStack(config, `candidate ${targetSlot}`);
			logInfo(`API migration head before upgrade: ${preUpgradeHead ?? "none"}`);
			if (config.upgrade.db_snapshot_on_api_upgrade) {
				snapshotPath = createApiDbUpgradeBackup(config, activeReleaseBeforeUpgrade, config.release.version);
			}
			runApiMigrationJsonCommand(config, config.images.api, ["latest"]);
			const postUpgradeHead = runApiMigrationJsonCommand(config, config.images.api, ["head"]).currentHead;
			logInfo(`API migration head after upgrade: ${postUpgradeHead ?? "none"}`);
			waitForApiSlotHealthy(config, targetSlot);
			currentState = normalizeGeneratedState({
				...candidateState,
				deployment: {
					...createPromotedApiDeploymentState(config, candidateState),
					maintenance_mode: false,
				},
			});
			writeDeployArtifacts(config, currentState);
			activateFrontendReleaseForState(config, currentState, config.release.version);
			sleepSeconds(3);
			promoted = true;
			if (snapshotPath && !currentOptions.dryRun) {
				fs.rmSync(snapshotPath, { force: true });
			}
		} catch (error) {
			const rollbackTarget = preUpgradeHead ?? "zero";
			try {
				logWarn(`Candidate deploy failed after migration. Rolling schema back to ${rollbackTarget}.`);
				runApiMigrationJsonCommand(config, config.images.api, ["rollback_to", rollbackTarget]);
			} catch (rollbackError) {
				if (!snapshotPath) {
					throw new Error(
						`Deploy failed and migration rollback failed: ${error instanceof Error ? error.message : String(error)}\n${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
					);
				}
				logWarn(`Migration rollback failed. Restoring DB snapshot ${snapshotPath}.`);
				restoreApiDbUpgradeBackup(config, snapshotPath);
				usedSnapshotRestore = true;
			}
			const recoveredState = normalizeGeneratedState({
				...originalState,
				deployment: {
					...originalState.deployment,
					maintenance_mode: false,
				},
			});
			writeDeployArtifacts(config, recoveredState);
			deployRenderedStack(config, "rollback recovery");
			waitForApiSlotHealthy(config, recoveredState.deployment.active_slot);
			if (snapshotPath && !config.upgrade.keep_failed_upgrade_db_snapshot && !currentOptions.dryRun) {
				fs.rmSync(snapshotPath, { force: true });
			}
			throw new Error(
				usedSnapshotRestore
					? `Deploy failed after DB migration. Previous release was restored using DB snapshot recovery. ${error instanceof Error ? error.message : String(error)}`
					: `Deploy failed after DB migration. Previous release was restored. ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	currentState = normalizeGeneratedState({
		...currentState,
		deployment: {
			...createSteadyApiDeploymentState(config, currentState),
			maintenance_mode: false,
		},
	});
	writeDeployArtifacts(config, currentState);
	if (!promoted) {
		activateFrontendReleaseForState(config, currentState, config.release.version);
		deployRenderedStack(config, "steady");
	}
	waitForHealthyServices(config, [
		{ label: "traefik", getHealth: services => serviceHealth(services, `${config.services.stack_name}_traefik`) },
		{ label: "keycloak", getHealth: services => serviceHealth(services, `${config.services.stack_name}_keycloak`) },
		{ label: "openfga", getHealth: services => serviceHealth(services, `${config.services.stack_name}_openfga`) },
		{ label: "minikms", getHealth: services => serviceHealth(services, `${config.services.stack_name}_minikms`) },
		{ label: "clickstack", getHealth: services => serviceHealth(services, `${config.services.stack_name}_clickstack`) },
		...(isOssConfig(config) ? [] : [{ label: "landing", getHealth: services => serviceHealth(services, `${config.services.stack_name}_landing_nginx`) }]),
		{ label: "web", getHealth: services => serviceHealth(services, `${config.services.stack_name}_web_nginx`) },
		{ label: "api", getHealth: services => apiHealth(services, config.services.stack_name) },
	]);
	waitForApiSlotHealthy(config, currentState.deployment.active_slot);
	currentState = normalizeGeneratedState({
		...currentState,
		deployment: markActiveApiSlotDeployed(config, currentState.deployment),
	});
	persistGeneratedState(config, currentState);
	logInfo(`Active API slot: ${currentState.deployment.active_slot}`);
	if (currentState.deployment.previous_slot) {
		logInfo(`Rollback slot: ${currentState.deployment.previous_slot}`);
	}
	logSuccess("Deploy completed");
}

async function cmdPromote(target?: string) {
	logSection("Promote");
	const { config, generated } = loadState();
	logReleaseContext(config);
	assertSwarmManager();
	assertBootstrapState(generated);
	const currentState = normalizeGeneratedState(generated);
	const activeSlot = currentState.deployment.active_slot;
	const targetSlot = target === "blue" || target === "green" ? target : otherApiSlot(activeSlot);
	if (targetSlot === activeSlot) {
		logInfo(`API slot ${targetSlot} is already active`);
		return;
	}
	if (!slotHasApiDeployment(currentState.deployment.slots[targetSlot])) {
		throw new Error(`Cannot promote API slot '${targetSlot}' because it has no deployed image recorded.`);
	}
	const promotedState = normalizeGeneratedState({
		...currentState,
		deployment: {
			active_slot: targetSlot,
			previous_slot: activeSlot,
			maintenance_mode: false,
			slots: currentState.deployment.slots,
		},
	});
	writeDeployArtifacts(config, promotedState);
	if (
		exists(releaseAssetDir("web", promotedState.deployment.slots[targetSlot].release_version)) &&
		exists(releaseAssetDir("landing", promotedState.deployment.slots[targetSlot].release_version))
	) {
		activateFrontendReleaseForState(config, promotedState);
	} else {
		logWarn(`Missing staged frontend assets for release ${promotedState.deployment.slots[targetSlot].release_version}; leaving current frontend assets unchanged.`);
	}
	sleepSeconds(3);
	waitForApiSlotHealthy(config, targetSlot);
	const persistedState = normalizeGeneratedState({
		...promotedState,
		deployment: touchApiSlotDeployment(promotedState.deployment, targetSlot),
	});
	persistGeneratedState(config, persistedState);
	logInfo(`Active API slot: ${targetSlot}`);
	logInfo(`Rollback slot: ${activeSlot}`);
	logSuccess("Promotion completed");
}

async function cmdRollback() {
	logSection("Rollback");
	const { config, generated } = loadState();
	logReleaseContext(config);
	assertSwarmManager();
	assertBootstrapState(generated);
	const currentState = normalizeGeneratedState(generated);
	const rollbackState = normalizeGeneratedState({
		...currentState,
		deployment: {
			...createRolledBackApiDeploymentState(currentState),
			maintenance_mode: false,
		},
	});
	writeDeployArtifacts(config, rollbackState);
	if (
		exists(releaseAssetDir("web", rollbackState.deployment.slots[rollbackState.deployment.active_slot].release_version)) &&
		exists(releaseAssetDir("landing", rollbackState.deployment.slots[rollbackState.deployment.active_slot].release_version))
	) {
		activateFrontendReleaseForState(config, rollbackState);
	} else {
		logWarn(`Missing staged frontend assets for release ${rollbackState.deployment.slots[rollbackState.deployment.active_slot].release_version}; leaving current frontend assets unchanged.`);
	}
	sleepSeconds(3);
	waitForApiSlotHealthy(config, rollbackState.deployment.active_slot);
	persistGeneratedState(config, normalizeGeneratedState({
		...rollbackState,
		deployment: touchApiSlotDeployment(rollbackState.deployment, rollbackState.deployment.active_slot),
	}));
	logInfo(`Active API slot: ${rollbackState.deployment.active_slot}`);
	if (rollbackState.deployment.previous_slot) {
		logInfo(`Rollback slot: ${rollbackState.deployment.previous_slot}`);
	}
	logSuccess("Rollback completed");
}

async function cmdHealth(asJson: boolean) {
	const { config, generated } = loadState();
	const hosts = domainMap(config.domain.root_domain);
	const services = listStackServices(config);
	const stackName = config.services.stack_name;
	const traefikDynamic = exists(TRAEFIK_DYNAMIC_FILE) ? fs.readFileSync(TRAEFIK_DYNAMIC_FILE, "utf8") : "";
	const webRuntimeConfig = readRenderedRuntimeConfig(path.join(RELEASES_ROOT, "web", "current", "runtime-config.js"));
	const landingRuntimeConfig = readRenderedRuntimeConfig(path.join(RELEASES_ROOT, "landing", "current", "runtime-config.js"));
	const clickstackSearchState = getClickstackSearchState(config);
	const sourceNames = new Set(clickstackSearchState?.sourceNames ?? []);
	const savedSearchNames = new Set((clickstackSearchState?.savedSearches ?? []).map(search => search.name).filter(Boolean));
	const savedSearchTags = new Set((clickstackSearchState?.savedSearches ?? []).flatMap(search => search.tags ?? []));
	const dashboardTags = new Set(clickstackSearchState?.dashboardTags ?? []);
	const combinedTags = new Set([...savedSearchTags, ...dashboardTags]);
	const databaseHealth = getApiMigrationHealth(config, generated);
	const bootstrapServices = {
		postgres: serviceHealth(services, `${stackName}_postgres`),
		redis: serviceHealth(services, `${stackName}_redis`),
		rustfs: serviceHealth(services, `${stackName}_rustfs`),
		keycloak: serviceHealth(services, `${stackName}_keycloak`),
		openfga: serviceHealth(services, `${stackName}_openfga`),
		minikms: serviceHealth(services, `${stackName}_minikms`),
	};
	const checks = {
		edition: config.edition ?? "enterprise",
		bootstrap: {
			completed: hasCompleteBootstrapState(generated) && generated.bootstrap.completed_at.length > 0,
			completed_at: generated.bootstrap.completed_at || null,
			services: bootstrapServices,
		},
		deploy: {
			active_slot: generated.deployment.active_slot,
			previous_slot: generated.deployment.previous_slot || null,
			maintenance_mode: generated.deployment.maintenance_mode,
			api: apiHealth(services, stackName),
			api_slots: {
				blue: {
					service: serviceHealth(services, slotStackServiceName(config, "blue")),
					image: generated.deployment.slots.blue.api_image || null,
					release_version: generated.deployment.slots.blue.release_version || null,
					deployed_at: generated.deployment.slots.blue.deployed_at || null,
					active: generated.deployment.active_slot === "blue",
				},
				green: {
					service: serviceHealth(services, slotStackServiceName(config, "green")),
					image: generated.deployment.slots.green.api_image || null,
					release_version: generated.deployment.slots.green.release_version || null,
					deployed_at: generated.deployment.slots.green.deployed_at || null,
					active: generated.deployment.active_slot === "green",
				},
			},
			web: serviceHealth(services, `${stackName}_web_nginx`),
			landing: serviceHealth(services, `${stackName}_landing_nginx`),
		},
		database: {
			api: databaseHealth,
		},
		observability: {
			service: serviceHealth(services, `${stackName}_clickstack`),
			obs_ui: {
				url: publicHttpsUrl(config, hosts.obs),
				configured: traefikDynamic.includes("obs-ui-router"),
			},
			obs_api: {
				url: publicHttpsUrl(config, hosts.obs, "/api"),
				configured: traefikDynamic.includes("obs-api-router"),
			},
			obs_otlp: {
				url: publicHttpsUrl(config, hosts.obs, "/v1/traces"),
				configured: traefikDynamic.includes("obs-otlp-router"),
			},
			frontend_otel_endpoint: {
				web: publicHttpsUrl(config, hosts.obs),
				landing: publicHttpsUrl(config, hosts.obs),
			},
			browser_replay_runtime: {
				web: {
					configured: Boolean(webRuntimeConfig?.hyperdxApiKey && webRuntimeConfig?.hyperdxUrl && !webRuntimeConfig?.hyperdxDisabled),
					hyperdx_url: webRuntimeConfig?.hyperdxUrl ?? null,
				},
				landing: {
					configured: Boolean(landingRuntimeConfig?.hyperdxApiKey && landingRuntimeConfig?.hyperdxUrl && !landingRuntimeConfig?.hyperdxDisabled),
					hyperdx_url: landingRuntimeConfig?.hyperdxUrl ?? null,
				},
			},
			sessions_source: {
				configured: sourceNames.has("Sessions"),
			},
			saved_searches: {
				configured: REQUIRED_CLICKSTACK_SAVED_SEARCHES.every(name => savedSearchNames.has(name)),
				required: [...REQUIRED_CLICKSTACK_SAVED_SEARCHES],
				missing: REQUIRED_CLICKSTACK_SAVED_SEARCHES.filter(name => !savedSearchNames.has(name)),
			},
			tags: {
				configured: REQUIRED_CLICKSTACK_TAGS.every(tag => combinedTags.has(tag)),
				required: [...REQUIRED_CLICKSTACK_TAGS],
				missing: REQUIRED_CLICKSTACK_TAGS.filter(tag => !combinedTags.has(tag)),
			},
		},
		public: {
			...(isOssConfig(config) ? {} : { landing: publicHttpsUrl(config, hosts.landing) }),
			app: publicHttpsUrl(config, hosts.app),
			api: publicHttpsUrl(config, hosts.api, "/health"),
			auth: publicHttpsUrl(config, hosts.auth, `/realms/${config.auth.keycloak_realm}/.well-known/openid-configuration`),
			obs: publicHttpsUrl(config, hosts.obs),
		},
		frontend_runtime: {
			web: {
				api_base_url: webRuntimeConfig?.apiBaseUrl ?? null,
				app_base_url: webRuntimeConfig?.appBaseUrl ?? null,
				auth_base_url: webRuntimeConfig?.authBaseUrl ?? null,
				api_docs_url: webRuntimeConfig?.apiDocsUrl ?? null,
				release_version: webRuntimeConfig?.releaseVersion ?? null,
				active_api_slot: webRuntimeConfig?.activeApiSlot ?? null,
			},
			landing: {
				api_base_url: landingRuntimeConfig?.apiBaseUrl ?? null,
				app_base_url: landingRuntimeConfig?.appBaseUrl ?? null,
				auth_base_url: landingRuntimeConfig?.authBaseUrl ?? null,
				api_docs_url: landingRuntimeConfig?.apiDocsUrl ?? null,
				release_version: landingRuntimeConfig?.releaseVersion ?? null,
				active_api_slot: landingRuntimeConfig?.activeApiSlot ?? null,
			},
		},
	};
	if (asJson) {
		console.log(JSON.stringify(checks, null, 2));
		return;
	}
	printHealthSummary(checks);
}

async function cmdUpgrade(targetVersion?: string) {
	logSection("Upgrade");
	const { config } = loadState();
	const desiredVersion = targetVersion ?? getDeployCliVersion();
	assertSemverVersion(desiredVersion, "target release version");
	config.release.version = desiredVersion;
	config.source = {
		...config.source,
		ref: `v${desiredVersion}`,
	};
	logReleaseContext(config);
	if (!isOssConfig(config) && !currentOptions.dryRun) {
		ensureEnterpriseLicenseFilesReadable();
	}
	config.images = {
		...config.images,
		...versionedImages(desiredVersion),
	};
	saveDesiredConfig(config);
	if (currentOptions.dryRun) {
		logDryRun(`Would upgrade stack to release ${desiredVersion}`);
	}
	await cmdDeploy();
}

async function cmdUpgradeDeps() {
	logSection("Upgrade Dependencies");
	const { config } = loadState();
	logReleaseContext(config);
	config.images.traefik = "traefik:v3.6.6";
	config.images.clickstack = "clickhouse/clickstack-all-in-one:latest";
	config.images.otel_agent = "otel/opentelemetry-collector-contrib:0.111.0";
	saveDesiredConfig(config);
	if (currentOptions.dryRun) {
		logDryRun("Would refresh dependency image tags and redeploy");
	}
	await cmdDeploy();
}

function sha256File(filePath: string) {
	const hash = createHash("sha256");
	hash.update(fs.readFileSync(filePath));
	return hash.digest("hex");
}

function parseEnterpriseLicenseBundle(raw: unknown): EnterpriseLicenseCertificateBundle {
	if (!raw || typeof raw !== "object") {
		throw new Error("Invalid Enterprise license certificate bundle: expected an object.");
	}
	const candidate = raw as Partial<EnterpriseLicenseCertificateBundle>;
	const requiredStrings: Array<keyof EnterpriseLicenseCertificateBundle> = [
		"certificate_pem",
		"private_key_pem",
		"root_ca_pem",
		"serial_hex",
		"certificate_fingerprint_sha256",
		"root_ca_fingerprint_sha256",
		"issued_at",
		"expires_at",
	];
	for (const key of requiredStrings) {
		if (typeof candidate[key] !== "string" || candidate[key].length === 0) {
			throw new Error(`Invalid Enterprise license certificate bundle: missing ${String(key)}.`);
		}
	}
	if (!candidate.metadata || candidate.metadata.edition !== "enterprise") {
		throw new Error("Invalid Enterprise license certificate bundle: missing enterprise metadata.");
	}
	return candidate as EnterpriseLicenseCertificateBundle;
}

function readEnterpriseLicenseBundle(bundlePath: string): EnterpriseLicenseCertificateBundle {
	return parseEnterpriseLicenseBundle(JSON.parse(fs.readFileSync(bundlePath, "utf8")));
}

function normalizeLicenseServerUrl(serverUrl: string, route: "issue" | "renew") {
	const trimmed = serverUrl.replace(/\/+$/, "");
	return `${trimmed}/v1/certificates/${route}`;
}

async function requestEnterpriseLicenseCertificate(config: DeployConfig, route: "issue" | "renew") {
	const license = config.license;
	if (!license?.server_url) {
		throw new Error(`Missing license.server_url in ${DEPLOY_YAML}. Set it or use license.certificate_bundle_file.`);
	}
	if (!license.key) {
		throw new Error(`Missing license.key in ${DEPLOY_YAML}.`);
	}
	const installFingerprint = license.install_fingerprint || deterministicInstallFingerprint(config.domain.root_domain, config.services.stack_name);
	const response = await fetch(normalizeLicenseServerUrl(license.server_url, route), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-license-server-access-key": license.key,
		},
		body: JSON.stringify({
			license_key: license.key,
			install_fingerprint: installFingerprint,
			root_domain: config.domain.root_domain,
			stack_name: config.services.stack_name,
			edition: "enterprise",
			requested_validity_days: license.certificate_validity_days ?? 1095,
		}),
	});
	const body = await response.json().catch(() => ({})) as { bundle?: unknown; message?: string; error?: string };
	if (!response.ok || !body.bundle) {
		throw new Error(body.error || body.message || `License certificate ${route} failed with HTTP ${response.status}`);
	}
	return parseEnterpriseLicenseBundle(body.bundle);
}

function writeEnterpriseLicenseBundle(bundle: EnterpriseLicenseCertificateBundle) {
	writeFileMaybe(LICENSE_BUNDLE_FILE, JSON.stringify(bundle, null, 2) + "\n", LICENSE_FILE_MODE);
	writeFileMaybe(
		LICENSE_CERT_FILE,
		bundle.certificate_pem.endsWith("\n") ? bundle.certificate_pem : `${bundle.certificate_pem}\n`,
		LICENSE_FILE_MODE,
	);
	writeFileMaybe(
		LICENSE_KEY_FILE,
		bundle.private_key_pem.endsWith("\n") ? bundle.private_key_pem : `${bundle.private_key_pem}\n`,
		LICENSE_FILE_MODE,
	);
	writeFileMaybe(LICENSE_ROOT_CA_FILE, bundle.root_ca_pem.endsWith("\n") ? bundle.root_ca_pem : `${bundle.root_ca_pem}\n`, LICENSE_FILE_MODE);
}

async function ensureEnterpriseCertificateBundle(config: DeployConfig) {
	if (isOssConfig(config)) return;
	ensureEnterpriseLicenseFilesReadable();
	if (exists(LICENSE_BUNDLE_FILE) && exists(LICENSE_CERT_FILE) && exists(LICENSE_KEY_FILE) && exists(LICENSE_ROOT_CA_FILE)) {
		validateEnterpriseLicenseBundleFiles(config, false);
		return;
	}
	if (currentOptions.dryRun) {
		logDryRun(`Would install or issue Enterprise certificate bundle under ${LICENSE_ROOT}`);
		return;
	}
	if (config.license?.certificate_bundle_file) {
		logStep("Installing Enterprise certificate bundle from configured file");
		const bundle = readEnterpriseLicenseBundle(config.license.certificate_bundle_file);
		writeEnterpriseLicenseBundle(bundle);
		validateEnterpriseLicenseBundleFiles(config, false);
		return;
	}
	if (config.license?.server_url && config.license.key) {
		logStep("Issuing Enterprise certificate bundle from license server");
		const bundle = await requestEnterpriseLicenseCertificate(config, "issue");
		writeEnterpriseLicenseBundle(bundle);
		validateEnterpriseLicenseBundleFiles(config, false);
		return;
	}
	throw new Error(
		`Enterprise deployments require a certificate bundle. Configure license.server_url and license.key, set license.certificate_bundle_file, or run 'envsync-deploy license issue-cert'.`,
	);
}

function validateEnterpriseLicenseBundleFiles(config: DeployConfig, verbose = true) {
	if (isOssConfig(config)) {
		if (verbose) logInfo("OSS deployments do not use Enterprise license certificates.");
		return null;
	}
	const bundle = readEnterpriseLicenseBundle(LICENSE_BUNDLE_FILE);
	if (bundle.metadata.install_fingerprint !== config.license?.install_fingerprint) {
		throw new Error("Installed Enterprise certificate bundle does not match deploy.yaml license.install_fingerprint.");
	}
	if (bundle.metadata.stack_name !== config.services.stack_name) {
		throw new Error("Installed Enterprise certificate bundle does not match deploy.yaml services.stack_name.");
	}
	if (bundle.metadata.root_domain !== config.domain.root_domain) {
		throw new Error("Installed Enterprise certificate bundle does not match deploy.yaml domain.root_domain.");
	}
	for (const filePath of [LICENSE_CERT_FILE, LICENSE_KEY_FILE, LICENSE_ROOT_CA_FILE]) {
		if (!exists(filePath)) throw new Error(`Missing Enterprise license file: ${filePath}`);
	}
	if (verbose) {
		logSuccess(`Enterprise certificate bundle is installed at ${LICENSE_ROOT}`);
		logInfo(`Certificate serial: ${bundle.serial_hex}`);
		logInfo(`Certificate expires: ${bundle.expires_at}`);
	}
	return bundle;
}

async function cmdLicense(action = "validate-cert") {
	logSection("Enterprise License");
	const config = loadConfig();
	if (isOssConfig(config)) {
		logInfo("OSS deployments do not require license verification.");
		return;
	}
	ensureEnterpriseLicenseFilesReadable();
	if (action === "issue-cert" || action === "renew-cert") {
		const route = action === "renew-cert" ? "renew" : "issue";
		if (currentOptions.dryRun) {
			logDryRun(`Would ${route} Enterprise certificate bundle and install it under ${LICENSE_ROOT}`);
			return;
		}
		const bundle = config.license?.certificate_bundle_file
			? readEnterpriseLicenseBundle(config.license.certificate_bundle_file)
			: await requestEnterpriseLicenseCertificate(config, route);
		writeEnterpriseLicenseBundle(bundle);
		validateEnterpriseLicenseBundleFiles(config);
		return;
	}
	if (action === "validate-cert") {
		validateEnterpriseLicenseBundleFiles(config);
		return;
	}
	throw new Error("Unknown license action. Expected issue-cert, renew-cert, or validate-cert.");
}

function stackVolumeName(config: DeployConfig, name: (typeof STACK_VOLUMES)[number]) {
	return `${config.services.stack_name}_${name}`;
}

function hasManagedRuntime(config: DeployConfig) {
	return stackExists(config) || listManagedContainers(config).length > 0;
}

function stopManagedRuntime(config: DeployConfig, label = "Stopping existing EnvSync services") {
	const containerIds = listManagedContainers(config);
	const networkName = stackNetworkName(config);

	logStep(label);
	if (currentOptions.dryRun) {
		if (stackExists(config)) {
			logDryRun(`Would remove stack ${config.services.stack_name}`);
			logCommand("docker", ["stack", "rm", config.services.stack_name]);
		}
		if (containerIds.length > 0) {
			logDryRun(`Would remove containers: ${containerIds.join(", ")}`);
			logCommand("docker", ["rm", "-f", ...containerIds]);
		}
		logDryRun(`Would remove network ${networkName} if present`);
		logCommand("docker", ["network", "rm", networkName]);
		logSuccess("Managed EnvSync runtime stop preview completed");
		return;
	}

	if (stackExists(config)) {
		logCommand("docker", ["stack", "rm", config.services.stack_name]);
		run("docker", ["stack", "rm", config.services.stack_name]);
		waitForStackRemoval(config);
	}

	const refreshedContainers = listManagedContainers(config);
	if (refreshedContainers.length > 0) {
		logCommand("docker", ["rm", "-f", ...refreshedContainers]);
		const removed = runIgnoringAbsent("docker", ["rm", "-f", ...refreshedContainers], {
			absentPatterns: ["no such container", "not found"],
		});
		if (!removed) {
			logInfo("Managed containers were already absent");
		}
	}

	if (commandSucceeds("docker", ["network", "inspect", networkName])) {
		logCommand("docker", ["network", "rm", networkName]);
		const removed = runIgnoringAbsent("docker", ["network", "rm", networkName], {
			absentPatterns: ["network", "not found", "no such network"],
		});
		if (!removed) {
			logInfo(`Network ${networkName} was already absent`);
		}
	}

	logSuccess("Existing EnvSync services stopped");
}

function backupDockerVolume(volumeName: string, targetDir: string) {
	logStep(`Backing up Docker volume ${volumeName}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would back up ${volumeName} into ${targetDir}`);
		return;
	}
	ensureDir(targetDir);
	run("docker", [
		"run",
		"--rm",
		"-v",
		`${volumeName}:/from:ro`,
		"-v",
		`${targetDir}:/to`,
		"alpine:3.20",
		"sh",
		"-lc",
		"cd /from && tar -czf /to/volume.tar.gz .",
	]);
	logSuccess(`Backed up Docker volume ${volumeName}`);
}

function restoreDockerVolume(volumeName: string, sourceDir: string) {
	logStep(`Restoring Docker volume ${volumeName}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would restore ${volumeName} from ${sourceDir}`);
		return;
	}
	run("docker", ["volume", "create", volumeName], { quiet: true });
	run("docker", [
		"run",
		"--rm",
		"-v",
		`${volumeName}:/to`,
		"-v",
		`${sourceDir}:/from:ro`,
		"alpine:3.20",
		"sh",
		"-lc",
		"cd /to && tar -xzf /from/volume.tar.gz",
	]);
	logSuccess(`Restored Docker volume ${volumeName}`);
}

async function cmdBackup() {
	logSection("Backup");
	const { config } = loadState();
	const timestamp = new Date().toISOString().replace(/[:]/g, "-");
	const archiveBase = path.join(config.backup.output_dir, `envsync-backup-${timestamp}`);
	const manifestPath = `${archiveBase}.manifest.json`;
	const tarPath = `${archiveBase}.tar.gz`;
	const staged = path.join(BACKUPS_ROOT, `staging-${timestamp}`);
	logInfo(`Backup archive target: ${tarPath}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would stage backup files in ${staged}`);
		if (hasManagedRuntime(config)) {
			logWarn("Backup would temporarily stop the EnvSync stack to capture consistent volume data.");
			stopManagedRuntime(config, "Stopping existing EnvSync services for consistent backup");
			logDryRun("Would redeploy the EnvSync stack after the backup archive is created");
		}
		for (const volume of STACK_VOLUMES) {
			backupDockerVolume(stackVolumeName(config, volume), path.join(staged, "volumes", volume));
		}
		if (!isOssConfig(config)) {
			logDryRun(`Would include Enterprise license material from ${LICENSE_ROOT}`);
		}
		logDryRun(`Would write manifest ${manifestPath}`);
		logDryRun(`Would create archive ${tarPath}`);
		logSuccess("Backup dry-run completed");
		console.log(tarPath);
		return;
	}
	ensureDir(config.backup.output_dir);
	ensureDir(staged);
	const resumeRuntimeAfterBackup = hasManagedRuntime(config);
	let backupCompleted = false;
	let backupError: unknown = null;
	try {
		if (resumeRuntimeAfterBackup) {
			logWarn("Backup will temporarily stop the EnvSync stack to capture consistent volume data.");
			stopManagedRuntime(config, "Stopping existing EnvSync services for consistent backup");
		}
		writeFile(path.join(staged, "deploy.env"), fs.readFileSync(DEPLOY_ENV, "utf8"));
		writeFile(path.join(staged, "deploy.yaml"), fs.readFileSync(DEPLOY_YAML, "utf8"));
		writeFile(path.join(staged, "config.json"), fs.readFileSync(INTERNAL_CONFIG_JSON, "utf8"));
		writeFile(path.join(staged, "versions.lock.json"), fs.readFileSync(VERSIONS_LOCK, "utf8"));
		writeFile(path.join(staged, "docker-stack.bootstrap.base.yaml"), fs.readFileSync(BOOTSTRAP_BASE_STACK_FILE, "utf8"));
		writeFile(path.join(staged, "docker-stack.bootstrap.yaml"), fs.readFileSync(BOOTSTRAP_STACK_FILE, "utf8"));
		writeFile(path.join(staged, "docker-stack.yaml"), fs.readFileSync(STACK_FILE, "utf8"));
		writeFile(path.join(staged, "traefik-dynamic.yaml"), fs.readFileSync(TRAEFIK_DYNAMIC_FILE, "utf8"));
		writeFile(path.join(staged, "keycloak-realm.envsync.json"), fs.readFileSync(KEYCLOAK_REALM_FILE, "utf8"));
		writeFile(path.join(staged, "otel-agent.yaml"), fs.readFileSync(OTEL_AGENT_CONF, "utf8"));
		writeFile(path.join(staged, "clickhouse-listen.xml"), fs.readFileSync(CLICKSTACK_CLICKHOUSE_CONF, "utf8"));
		if (!isOssConfig(config) && exists(LICENSE_ROOT)) {
			fs.cpSync(LICENSE_ROOT, path.join(staged, "license"), { recursive: true });
		}
		const volumesDir = path.join(staged, "volumes");
		for (const volume of STACK_VOLUMES) {
			backupDockerVolume(stackVolumeName(config, volume), path.join(volumesDir, volume));
		}
		run("bash", ["-lc", `tar -czf ${JSON.stringify(tarPath)} -C ${JSON.stringify(staged)} .`]);
		const manifest = {
			archive: path.basename(tarPath),
			sha256: sha256File(tarPath),
			created_at: new Date().toISOString(),
			stack_name: config.services.stack_name,
			volumes: STACK_VOLUMES.map(volume => stackVolumeName(config, volume)),
		};
		writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
		backupCompleted = true;
	} catch (error) {
		backupError = error;
	} finally {
		if (resumeRuntimeAfterBackup) {
			try {
				logStep("Restarting EnvSync services after backup");
				await cmdDeploy();
			} catch (restartError) {
				if (backupError) {
					throw new Error(
						`Backup failed and automatic service restart also failed: ${backupError instanceof Error ? backupError.message : String(backupError)}\n${restartError instanceof Error ? restartError.message : String(restartError)}`,
					);
				}
				throw new Error(
					`Backup archive was created, but automatic service restart failed: ${restartError instanceof Error ? restartError.message : String(restartError)}`,
				);
			}
		}
	}
	if (backupError) {
		throw backupError instanceof Error ? backupError : new Error(String(backupError));
	}
	if (!backupCompleted) {
		throw new Error("Backup did not complete");
	}
	logSuccess("Backup completed");
	console.log(tarPath);
}

async function cmdRestore(archivePath: string, autoDeploy = false) {
	if (!archivePath) throw new Error("restore requires a .tar.gz path");
	logSection("Restore");
	const restoreRoot = path.join(BACKUPS_ROOT, `restore-${Date.now()}`);
	logInfo(`Restore archive: ${archivePath}`);
	if (currentOptions.dryRun) {
		logDryRun(`Would extract ${archivePath} into ${restoreRoot}`);
		logDryRun(`Would restore deploy files into ${DEPLOY_ROOT} and ${ETC_ROOT}`);
		if (hasManagedRuntime(loadState().config)) {
			stopManagedRuntime(loadState().config, "Stopping existing EnvSync services before restore");
		}
		logDryRun("Would restore all managed Docker volumes from the archive");
		logSuccess("Restore dry-run completed");
		return;
	}
	const currentConfig = loadState().config;
	if (hasManagedRuntime(currentConfig)) {
		logWarn("Restore will stop the existing EnvSync stack before replacing managed data volumes.");
		stopManagedRuntime(currentConfig, "Stopping existing EnvSync services before restore");
	}
	ensureDir(restoreRoot);
	run("bash", ["-lc", `tar -xzf ${JSON.stringify(archivePath)} -C ${JSON.stringify(restoreRoot)}`]);
	writeFile(DEPLOY_ENV, fs.readFileSync(path.join(restoreRoot, "deploy.env"), "utf8"), 0o600);
	writeFile(DEPLOY_YAML, fs.readFileSync(path.join(restoreRoot, "deploy.yaml"), "utf8"));
	writeFile(INTERNAL_CONFIG_JSON, fs.readFileSync(path.join(restoreRoot, "config.json"), "utf8"));
	writeFile(VERSIONS_LOCK, fs.readFileSync(path.join(restoreRoot, "versions.lock.json"), "utf8"));
	writeFile(BOOTSTRAP_BASE_STACK_FILE, fs.readFileSync(path.join(restoreRoot, "docker-stack.bootstrap.base.yaml"), "utf8"));
	writeFile(BOOTSTRAP_STACK_FILE, fs.readFileSync(path.join(restoreRoot, "docker-stack.bootstrap.yaml"), "utf8"));
	writeFile(STACK_FILE, fs.readFileSync(path.join(restoreRoot, "docker-stack.yaml"), "utf8"));
	writeFile(TRAEFIK_DYNAMIC_FILE, fs.readFileSync(path.join(restoreRoot, "traefik-dynamic.yaml"), "utf8"));
	writeFile(KEYCLOAK_REALM_FILE, fs.readFileSync(path.join(restoreRoot, "keycloak-realm.envsync.json"), "utf8"));
	writeFile(OTEL_AGENT_CONF, fs.readFileSync(path.join(restoreRoot, "otel-agent.yaml"), "utf8"));
	writeFile(CLICKSTACK_CLICKHOUSE_CONF, fs.readFileSync(path.join(restoreRoot, "clickhouse-listen.xml"), "utf8"));
	const restoredLicenseRoot = path.join(restoreRoot, "license");
	if (exists(restoredLicenseRoot)) {
		fs.rmSync(LICENSE_ROOT, { recursive: true, force: true });
		fs.cpSync(restoredLicenseRoot, LICENSE_ROOT, { recursive: true });
		ensureEnterpriseLicenseFilesReadable();
	}
	const config = loadConfig();
	for (const volume of STACK_VOLUMES) {
		restoreDockerVolume(stackVolumeName(config, volume), path.join(restoreRoot, "volumes", volume));
	}
	logSuccess("Restore completed");
	logInfo(`Restored archive: ${archivePath}`);
	logInfo(`Restored stack name: ${config.services.stack_name}`);
	if (autoDeploy) {
		logInfo("Starting services after restore because --deploy was provided");
		await cmdDeploy();
		return;
	}
	logInfo("Next: envsync-deploy deploy");
}

async function cmdVpn(args: string[]) {
	const action = args[0];
	switch (action) {
		case "pubkey":
			await cmdVpnPubkey();
			break;
		case "whitelist":
			await cmdVpnWhitelist(args[1]);
			break;
		case "status":
			await cmdVpnStatus();
			break;
		default:
			throw new Error("Usage: envsync-deploy vpn <pubkey|whitelist|status>");
	}
}

async function cmdVpnPubkey() {
	logSection("WireGuard VPN");
	const state = ensureWireguardState();
	writeWireguardConfig(state);
	logInfo(`WireGuard interface: envsync-wg`);
	logInfo(`Server config: ${WIREGUARD_CONFIG_FILE}`);
	logInfo(`Private key: ${WIREGUARD_PRIVATE_KEY_FILE}`);
	logInfo(`Public key: ${WIREGUARD_PUBLIC_KEY_FILE}`);
	logInfo(`Server listen port: ${state.listen_port}`);
	logInfo(`Network: ${state.network}`);
	console.log("");
	logSuccess(`Server public key: ${state.public_key}`);
}

async function cmdVpnWhitelist(clientPublicKeyArg?: string) {
	if (!clientPublicKeyArg) {
		throw new Error("usage: envsync-deploy vpn whitelist <client_public_key>");
	}
	const clientPublicKey = clientPublicKeyArg.trim();
	if (!clientPublicKey) {
		throw new Error("client public key cannot be empty");
	}
	const state = ensureWireguardState();
	const existing = state.peers.find(peer => peer.public_key === clientPublicKey);
	if (existing) {
		logWarn(`Client key already whitelisted for ${existing.allowed_ip}`);
		return;
	}
	const allowedIp = wireguardPeerAllowedIp(state);
	state.peers.push({
		public_key: clientPublicKey,
		allowed_ip: allowedIp,
		added_at: new Date().toISOString(),
	});
	state.peers.sort((a, b) => a.public_key.localeCompare(b.public_key));
	saveWireguardState(state);
	writeWireguardConfig(state);
	logSuccess(`Whitelisted client ${clientPublicKey}`);
	console.log(`AllowedIP: ${allowedIp}`);
	console.log(`Append to client config:`);
	console.log(`[Peer]`);
	console.log(`PublicKey = ${clientPublicKey}`);
	console.log(`AllowedIPs = ${allowedIp}`);
}

function getVpnStackName() {
	try {
		return loadConfig().services.stack_name;
	} catch {
		return "envsync";
	}
}

function listStackServiceNames(stackName: string) {
	const raw = tryRun("docker", ["service", "ls", "--filter", `label=com.docker.stack.namespace=${stackName}`, "--format", "{{.Name}}"], {
		quiet: true,
	});
	if (!raw.trim()) return [];
	return raw
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
}

function listServicePublishedPorts(serviceName: string) {
	const raw = tryRun("docker", ["service", "inspect", "--format", "{{json .Endpoint.Ports}}", serviceName], { quiet: true });
	const ports = parseJsonOrDefault(raw, [] as unknown) as unknown;
	const list = Array.isArray(ports) ? (ports as Array<unknown>) : [];
	if (list.length === 0) return [];
	return list
		.map(port => {
			const typed = port as DockerServicePort;
			if (!typed || typeof typed !== "object") return "";
			if (!typed.PublishedPort || !typed.TargetPort || !typed.Protocol) return "";
			const mode = typed.PublishMode || "ingress";
			return `${typed.PublishedPort}/${typed.Protocol} -> ${typed.TargetPort}/${typed.Protocol} (${mode})`;
		})
		.filter(Boolean);
}

function listRunningContainerEndpoints(serviceName: string) {
	const raw = tryRun(
		"docker",
		["service", "ps", serviceName, "--filter", "desired-state=running", "--no-trunc", "--format", "{{.ID}}"],
		{ quiet: true },
	);
	const taskIds = raw
		.split(/\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
	if (taskIds.length === 0) return [];

	const results: string[] = [];
	for (const taskId of taskIds) {
		const taskRaw = tryRun("docker", ["inspect", taskId, "--format", "{{json .}}"], { quiet: true });
		if (!taskRaw) continue;
		const parsedTaskInspect = parseJsonOrDefault(taskRaw, null as unknown);
		const inspect = (Array.isArray(parsedTaskInspect) ? parsedTaskInspect[0] : parsedTaskInspect) as DockerTaskInspect;
		if (!inspect || typeof inspect !== "object") continue;
		const containerId = inspect.Status?.ContainerStatus?.ContainerID ?? "";
		const addresses = Array.isArray(inspect.NetworksAttachments)
			? inspect.NetworksAttachments.flatMap(attachment => {
					const networkName = attachment.Network?.Spec?.Name ?? "overlay";
					const ips = Array.isArray(attachment.Addresses) ? attachment.Addresses : [];
					return ips
						.map(ip => {
							const trimmed = typeof ip === "string" ? ip.trim() : "";
							return trimmed ? `${networkName}:${trimmed}` : "";
						})
						.filter(Boolean);
			  })
			: [];
		const line = `task ${taskId.slice(0, 12)} container=${containerId.slice(0, 12) || "unknown"} ${
			addresses.length ? `ips=${addresses.join(", ")}` : "ips=none"
		}`;
		results.push(line);
	}
	return results;
}

async function cmdVpnStatus() {
	logSection("WireGuard VPN");
	const state = loadWireguardState();
	if (!state) {
		logWarn("WireGuard state not initialized.");
		logInfo("Run: envsync-deploy vpn pubkey");
		return;
	}
	logInfo(`Config file: ${WIREGUARD_CONFIG_FILE}`);
	logInfo(`State file: ${WIREGUARD_STATE_FILE}`);
	logInfo(`Server endpoint: 0.0.0.0:${state.listen_port}`);
	logInfo(`Network: ${state.network}`);
	logInfo(`Server IP: ${state.server_ip}`);
	if (state.peers.length === 0) {
		logInfo("Peers: none");
	} else {
		logInfo("Peers:");
		for (const peer of state.peers) {
			console.log(`  ${peer.public_key} -> ${peer.allowed_ip}`);
		}
	}
	console.log("");
	logInfo("Container endpoints:");
	const stackName = getVpnStackName();
	const services = listStackServiceNames(stackName);
	if (services.length === 0) {
		logWarn(`No running services found for stack ${stackName}`);
	} else {
		for (const service of services) {
			const ports = listServicePublishedPorts(service);
			const endpoints = listRunningContainerEndpoints(service);
			console.log(`  ${service}`);
			console.log(`    Published ports: ${ports.length ? ports.join(", ") : "none"}`);
			if (endpoints.length === 0) {
				console.log("    Containers: none running");
			} else {
				for (const endpoint of endpoints) {
					console.log(`    ${endpoint}`);
				}
			}
		}
	}
	try {
		const ifaceStatus = runCapture("wg", ["show", "envsync-wg"]);
		console.log("Runtime:");
		console.log(ifaceStatus);
	} catch {
		logWarn("WireGuard interface is not running in kernel yet. Run wg-quick up on the generated config to activate.");
	}
}

async function main() {
	const argv = process.argv.slice(2);
	const command = argv[0];
	const args = argv.slice(1);
	currentOptions = {
		dryRun: args.includes("--dry-run"),
		force: args.includes("--force"),
	};
	const positionals = args.filter(arg => arg !== "--dry-run" && arg !== "--force" && arg !== "--deploy");
	if (!command) {
		printOperatorOverview();
		process.exit(0);
	}
	switch (command) {
		case "preinstall":
			await cmdPreinstall();
			break;
		case "setup":
			await cmdSetup();
			break;
		case "bootstrap":
			await cmdBootstrap();
			break;
		case "deploy":
			await cmdDeploy();
			break;
		case "promote":
			await cmdPromote(positionals[0]);
			break;
		case "rollback":
			await cmdRollback();
			break;
		case "health":
			await cmdHealth(positionals[0] === "--json");
			break;
		case "plan-topology":
			cmdEnterpriseTopologyPlan(positionals[0], positionals.includes("--json"));
			break;
		case "validate-topology":
			cmdEnterpriseTopologyValidate(positionals[0], positionals.includes("--json"));
			break;
		case "upgrade":
			await cmdUpgrade(positionals[0]);
			break;
		case "upgrade-deps":
			await cmdUpgradeDeps();
			break;
		case "vpn":
			await cmdVpn(positionals);
			break;
		case "license":
			await cmdLicense(positionals[0]);
			break;
		case "backup":
			await cmdBackup();
			break;
		case "remove":
			await cmdRemove();
			break;
		case "restore":
			await cmdRestore(positionals[0] ?? "", args.includes("--deploy"));
			break;
		default:
			console.error(chalk.red(`Unknown command: ${command}`));
			console.log(renderHelpBlock());
			process.exit(1);
	}
}

main().catch(err => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
