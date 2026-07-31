import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";
import { z } from "zod";

export type DeployEdition = "oss" | "enterprise";

export class DeployPlanError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DeployPlanError";
	}
}

const deployConfigSchema = z.object({
	edition: z.enum(["oss", "enterprise"]).optional(),
	source: z.object({
		repo_url: z.string().default("https://github.com/EnvSync-Cloud/envsync.git"),
		ref: z.string().default("main"),
	}).default({}),
	release: z.object({
		version: z.string().default("0.8.7"),
		channel: z.string().default("stable"),
	}).default({}),
	domain: z.object({
		root_domain: z.string().default("example.com"),
		acme_email: z.string().default("ops@example.com"),
	}).default({}),
	services: z.object({
		stack_name: z.string().default("envsync"),
		api_port: z.number().int().positive().default(4000),
		management_api_port: z.number().int().positive().default(4001),
		public_http_port: z.number().int().positive().default(80),
		public_https_port: z.number().int().positive().default(443),
	}).default({}),
	images: z.object({
		api: z.string().default("ghcr.io/envsync-cloud/envsync-api:stable"),
		management_api: z.string().default("ghcr.io/envsync-cloud/envsync-management-api:stable"),
		web: z.string().default("ghcr.io/envsync-cloud/envsync-web-oss-static:stable"),
		enterprise_web: z.string().default("ghcr.io/envsync-cloud/envsync-web-static:stable"),
		landing: z.string().default("ghcr.io/envsync-cloud/envsync-landing-static:stable"),
		keycloak: z.string().default("envsync-keycloak:stable"),
		clickstack: z.string().default("ghcr.io/envsync-cloud/clickstack:stable"),
		otel_agent: z.string().default("otel/opentelemetry-collector-contrib:latest"),
	}).default({}),
	features: z.object({
		management_api: z.boolean().optional(),
		management_web: z.boolean().optional(),
		landing: z.boolean().optional(),
	}).default({}),
	observability: z.object({
		enabled: z.boolean().optional(),
		public_obs: z.boolean().optional(),
	}).default({}),
	license: z.object({
		required: z.boolean().optional(),
		server_url: z.string().optional(),
		key: z.string().optional(),
		install_fingerprint: z.string().optional(),
		lease_ttl_seconds: z.number().int().positive().default(300),
	}).default({}),
	frontend: z.object({
		dashboard_variant: z.enum(["oss", "enterprise"]).optional(),
		include_manage_subtree: z.boolean().optional(),
	}).default({}),
	vpn: z.object({
		provider: z.enum(["netbird", "none"]).default("none"),
		internal_domain: z.string().default("envsync.local"),
		nb_setup_key: z.string().default(""),
	}).default({}),
});

export type DeployConfig = z.infer<typeof deployConfigSchema>;

export interface FrontendArtifactPlan {
	id: "dashboard" | "management" | "landing";
	package_name: string;
	build_command: string;
	mount_path: string;
	included: boolean;
	merged_into_dashboard?: boolean;
	image: string | null;
}

export interface ServicePlan {
	id: string;
	enabled: boolean;
	tier: "core" | "enterprise" | "optional";
	reason: string;
	image: string | null;
}

export interface ReleaseArtifactPlan {
	npm_packages: Array<{
		name: string;
		registry: "npm" | "github-packages";
		edition: DeployEdition;
		publish: boolean;
	}>;
	container_images: Array<{
		name: string;
		image: string;
		build_target: string;
		edition: "shared" | DeployEdition;
	}>;
}

export interface DeploymentPlan {
	edition: DeployEdition;
	config: DeployConfig;
	services: ServicePlan[];
	frontend: FrontendArtifactPlan[];
	runtime_env: Record<string, string>;
	release_artifacts: ReleaseArtifactPlan;
	warnings: string[];
}

export function readDeployConfigFile(filePath: string) {
	const absolutePath = path.resolve(process.cwd(), filePath);
	if (!fs.existsSync(absolutePath)) {
		throw new DeployPlanError(`Deploy config file not found: ${absolutePath}`);
	}

	const raw = fs.readFileSync(absolutePath, "utf8");
	if (absolutePath.endsWith(".json")) {
		return JSON.parse(raw);
	}

	return YAML.parse(raw);
}

function validateEditionRules(config: DeployConfig, edition: DeployEdition) {
	const errors: string[] = [];

	if (edition === "oss") {
		if (config.edition === "enterprise") {
			errors.push("OSS deploy tooling cannot consume a config explicitly marked as enterprise.");
		}
		if (config.features.management_api === true) {
			errors.push("OSS edition cannot enable management_api.");
		}
		if (config.features.landing === true) {
			errors.push("OSS edition cannot enable landing.");
		}
		if (config.license.required === true) {
			errors.push("OSS edition cannot require enterprise licensing.");
		}
		if (config.license.server_url || config.license.key || config.license.install_fingerprint) {
			errors.push("OSS edition cannot include enterprise license server settings.");
		}
		if (config.frontend.dashboard_variant === "enterprise") {
			errors.push("OSS edition cannot use the enterprise dashboard variant.");
		}
	}

	if (edition === "enterprise") {
		if (config.edition === "oss") {
			errors.push("Enterprise deploy tooling cannot consume a config explicitly marked as oss.");
		}
		if (config.features.management_api === false) {
			errors.push("Enterprise edition must enable management_api.");
		}
		// Landing is Hosted-only marketing/signup (program plan Phase 2). Self-host must not require it.
		// Optional branding: features.landing === true may re-enable later; default is off.
		if (config.license.required === false) {
			errors.push("Enterprise edition must require licensing.");
		}
		if (!config.license.server_url) {
			errors.push("Enterprise edition requires license.server_url.");
		}
		if (config.frontend.dashboard_variant === "oss") {
			errors.push("Enterprise edition cannot use the OSS dashboard variant.");
		}
	}

	if (errors.length > 0) {
		throw new DeployPlanError(errors.join(" "));
	}
}

function buildServicePlans(config: DeployConfig, edition: DeployEdition): ServicePlan[] {
	const observabilityEnabled = config.observability.enabled ?? (edition === "enterprise");
	const managementEnabled = edition === "enterprise";
	// Hosted marketing/signup only — self-host topology omits landing by default (Phase 2).
	const landingEnabled = config.features.landing === true;

	return [
		{ id: "api", enabled: true, tier: "core", reason: "Required in all editions.", image: config.images.api },
		{ id: "web", enabled: true, tier: "core", reason: "Primary dashboard artifact.", image: edition === "enterprise" ? config.images.enterprise_web : config.images.web },
		{ id: "postgres", enabled: true, tier: "core", reason: "Core persistence.", image: null },
		{ id: "redis", enabled: true, tier: "core", reason: "Core cache and sessions.", image: null },
		{ id: "rustfs", enabled: true, tier: "core", reason: "Object storage for artifacts.", image: null },
		{ id: "openfga", enabled: true, tier: "core", reason: "Authorization service.", image: null },
		{ id: "minikms", enabled: true, tier: "core", reason: "Secret encryption service.", image: null },
		{ id: "keycloak", enabled: true, tier: "core", reason: "Authentication provider.", image: config.images.keycloak },
		{ id: "management-api", enabled: managementEnabled, tier: "enterprise", reason: managementEnabled ? "Enterprise control plane API." : "Not deployed in OSS.", image: managementEnabled ? config.images.management_api : null },
		{ id: "landing", enabled: landingEnabled, tier: "optional", reason: landingEnabled ? "Optional marketing surface (Hosted)." : "Omitted from self-host; user invites use dashboard.", image: landingEnabled ? config.images.landing : null },
		{ id: "clickstack", enabled: observabilityEnabled, tier: observabilityEnabled ? "optional" : "optional", reason: observabilityEnabled ? "Observability enabled for this topology." : "Observability disabled.", image: observabilityEnabled ? config.images.clickstack : null },
		{ id: "otel-agent", enabled: observabilityEnabled, tier: "optional", reason: observabilityEnabled ? "OTEL pipeline enabled for this topology." : "OTEL disabled.", image: observabilityEnabled ? config.images.otel_agent : null },
	];
}

function buildFrontendArtifacts(config: DeployConfig, edition: DeployEdition): FrontendArtifactPlan[] {
	const enterprise = edition === "enterprise";
	const landingEnabled = config.features.landing === true;

	return [
		{
			id: "dashboard",
			package_name: "envsync-web",
			build_command: enterprise ? "bun run --filter envsync-web build:enterprise" : "bun run --filter envsync-web build:oss",
			mount_path: "/",
			included: true,
			image: enterprise ? config.images.enterprise_web : config.images.web,
		},
		{
			id: "landing",
			package_name: "envsync-landing",
			build_command: "bun run --filter envsync-landing build",
			mount_path: "/",
			included: landingEnabled,
			image: landingEnabled ? config.images.landing : null,
		},
	];
}

function buildRuntimeEnv(config: DeployConfig, edition: DeployEdition) {
	const enterprise = edition === "enterprise";
	const observabilityEnabled = config.observability.enabled ?? enterprise;

	return {
		ENVSYNC_EDITION: edition,
		ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
		ENVSYNC_OBSERVABILITY_ENABLED: String(observabilityEnabled),
		ENVSYNC_MANAGEMENT_ENABLED: String(enterprise),
		// Landing is Hosted-only (program plan D3 / Phase 1).
		ENVSYNC_LANDING_ENABLED: "false",
		ENVSYNC_SINGLE_ORG_MODE: "true",
		ENVSYNC_MAX_ORGS: "1",
		ENVSYNC_LICENSE_ENFORCEMENT: String(enterprise),
		ENVSYNC_LICENSE_MODE: enterprise ? "certificate" : "none",
		ENVSYNC_LICENSE_BUNDLE_PATH: enterprise ? "/etc/envsync/license/enterprise-license-bundle.json" : "",
		ENVSYNC_LICENSE_CERT_PATH: enterprise ? "/etc/envsync/license/enterprise-cert.pem" : "",
		ENVSYNC_LICENSE_KEY_PATH: enterprise ? "/etc/envsync/license/enterprise-key.pem" : "",
		ENVSYNC_LICENSE_ROOT_CA_CERT_PATH: enterprise ? "/etc/envsync/license/root-ca.pem" : "",
		MANAGEMENT_API_URL: enterprise ? `https://manage-api.${config.domain.root_domain}` : "",
		ENVSYNC_LICENSE_SERVER_URL: enterprise ? (config.license.server_url ?? "") : "",
		ENVSYNC_LICENSE_KEY: enterprise ? (config.license.key ?? "") : "",
		ENVSYNC_INSTALL_FINGERPRINT: enterprise ? (config.license.install_fingerprint ?? "") : "",
		ENVSYNC_LICENSE_LEASE_TTL_SECONDS: String(config.license.lease_ttl_seconds),
		ENVSYNC_STACK_NAME: config.services.stack_name,
		ENVSYNC_RELEASE_VERSION: config.release.version,
	};
}

function buildReleaseArtifacts(config: DeployConfig, edition: DeployEdition): ReleaseArtifactPlan {
	const npmPackages: ReleaseArtifactPlan["npm_packages"] = [
		{
			name: "@envsync-cloud/deploy",
			registry: "npm",
			edition: "oss",
			publish: edition === "oss",
		},
		{
			name: "@envsync-cloud/deploy-enterprise",
			registry: "github-packages",
			edition: "enterprise",
			publish: edition === "enterprise",
		},
	];

	const container_images: ReleaseArtifactPlan["container_images"] = [
		{
			name: "envsync-api",
			image: config.images.api,
			build_target: "packages/envsync-api",
			edition: "shared",
		},
	];

	if (edition === "enterprise") {
		container_images.push(
			{
				name: "envsync-management-api",
				image: config.images.management_api,
				build_target: "packages/envsync-management-api",
				edition: "enterprise",
			},
			{
				name: "envsync-web-static",
				image: config.images.enterprise_web,
				build_target: "apps/envsync-web#build:enterprise",
				edition: "enterprise",
			},
			{
				name: "envsync-landing-static",
				image: config.images.landing,
				build_target: "apps/envsync-landing#build",
				edition: "enterprise",
			},
		);
	} else {
		container_images.push({
			name: "envsync-web-oss-static",
			image: config.images.web,
			build_target: "apps/envsync-web#build:oss",
			edition: "oss",
		});
	}

	return {
		npm_packages: npmPackages,
		container_images,
	};
}

export function createDeploymentPlan(rawConfig: unknown, forcedEdition?: DeployEdition): DeploymentPlan {
	const config = deployConfigSchema.parse(rawConfig);
	const edition = forcedEdition ?? config.edition ?? "oss";

	validateEditionRules(config, edition);

	const warnings: string[] = [];
	if (edition === "oss" && (config.observability.enabled ?? false) === false) {
		warnings.push("Observability is disabled for OSS. ClickStack and OTEL services will be omitted.");
	}
	if (edition === "enterprise" && !config.license.key) {
		warnings.push("Enterprise topology is valid, but license.key is empty. Activation will fail until a real key is supplied.");
	}

	return {
		edition,
		config,
		services: buildServicePlans(config, edition),
		frontend: buildFrontendArtifacts(config, edition),
		runtime_env: buildRuntimeEnv(config, edition),
		release_artifacts: buildReleaseArtifacts(config, edition),
		warnings,
	};
}

export function loadDeploymentPlanFromFile(filePath: string, forcedEdition?: DeployEdition) {
	return createDeploymentPlan(readDeployConfigFile(filePath), forcedEdition);
}

export function formatDeploymentPlan(plan: DeploymentPlan, format: "json" | "yaml" = "yaml") {
	if (format === "json") {
		return JSON.stringify(plan, null, 2);
	}

	return YAML.stringify(plan);
}
