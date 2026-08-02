export interface DeployConfig {
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
	license?: {
		server_url?: string;
		key?: string;
		install_fingerprint?: string;
		certificate_bundle_file?: string;
		lease_ttl_seconds?: number;
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
	release_channel?: string;
}

export type ApiSlot = "blue" | "green";
export type ApiSlotState = {
	api_image: string;
	release_version: string;
	deployed_at: string;
};
export type RuntimeEnv = Record<string, string>;

export interface DeployGeneratedState {
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

export interface DeployRenderPaths {
	traefikStateRoot: string;
	deployRoot: string;
	releasesRoot: string;
	keycloakRealmFile: string;
	clickstackClickhouseConf: string;
	otelAgentConf: string;
	nginxLandingConf: string;
	nginxWebConf: string;
	nginxApiMaintenanceConf: string;
	nginxVpnConf: string;
}

export type DeployRenderMode = "base" | "bootstrap" | "full";

function domainMap(rootDomain: string) {
	return {
		landing: rootDomain,
		app: `app.${rootDomain}`,
		api: `api.${rootDomain}`,
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

function publicHttpsUrl(config: DeployConfig, host: string, urlPath = "") {
	return `${publicHttpsOrigin(config, host)}${urlPath}`;
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

function publicHttpsUrlVariants(config: DeployConfig, host: string, urlPath = "") {
	return publicHttpsOriginVariants(config, host).map(origin => `${origin}${urlPath}`);
}

function keycloakImageTag(image: string) {
	return image.split(":").slice(1).join(":") || "local";
}

function slotServiceName(slot: ApiSlot) {
	return `envsync_api_${slot}`;
}

function slotHasApiDeployment(state: ApiSlotState) {
	return state.api_image.length > 0;
}

function isOssConfig(config: DeployConfig) {
	return config.edition === "oss";
}

function createSteadyApiDeploymentState(config: DeployConfig, generated: DeployGeneratedState) {
	const deployment = generated.deployment;
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

export function buildRuntimeEnv(
	config: DeployConfig,
	generated: DeployGeneratedState,
	options?: { setupToken?: string },
): RuntimeEnv {
	const hosts = domainMap(config.domain.root_domain);
	const bucketName = "envsync-bucket";
	const oss = isOssConfig(config);
	const enterprise = !oss;
	const license = config.license ?? {};
	return {
		NODE_ENV: "production",
		ENVSYNC_EDITION: oss ? "oss" : "enterprise",
		// Self-host product install — never multi-tenant SaaS mode (program plan Phase 1).
		ENVSYNC_DEPLOYMENT_MODE: "selfhosted",
		ENVSYNC_MANAGEMENT_ENABLED: oss ? "false" : "true",
		// Landing is Hosted-only; self-host does not ship marketing/signup surface.
		ENVSYNC_LANDING_ENABLED: "false",
		ENVSYNC_SINGLE_ORG_MODE: "true",
		// max_orgs from entitlement claims (Phase 4+); no product ENVSYNC_MAX_ORGS (Phase 7)
		// Operator setup token for POST /api/setup/org (Phase 1b).
		ENVSYNC_SETUP_TOKEN: options?.setupToken ?? "",
		ENVSYNC_LICENSE_ENFORCEMENT: oss ? "false" : "true",
		ENVSYNC_LICENSE_MODE: oss ? "none" : "certificate",
		ENVSYNC_LICENSE_BUNDLE_PATH: oss ? "" : "/etc/envsync/license/enterprise-license-bundle.json",
		ENVSYNC_LICENSE_CERT_PATH: oss ? "" : "/etc/envsync/license/enterprise-cert.pem",
		ENVSYNC_LICENSE_KEY_PATH: oss ? "" : "/etc/envsync/license/enterprise-key.pem",
		ENVSYNC_LICENSE_ROOT_CA_CERT_PATH: oss ? "" : "/etc/envsync/license/root-ca.pem",
		ENVSYNC_LICENSE_SERVER_URL: enterprise ? (license.server_url ?? "") : "",
		ENVSYNC_LICENSE_KEY: enterprise ? (license.key ?? "") : "",
		ENVSYNC_INSTALL_FINGERPRINT: enterprise ? (license.install_fingerprint ?? "") : "",
		ENVSYNC_LICENSE_LEASE_TTL_SECONDS: String(license.lease_ttl_seconds ?? 300),
		ENVSYNC_STACK_NAME: config.services.stack_name,
		DB_AUTO_MIGRATE: "false",
		PORT: `${config.services.api_port}`,
		MANAGEMENT_API_PORT: `${config.services.management_api_port}`,
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
		// Self-host: no landing; invite emails use dashboard accept routes (Phase 2).
		LANDING_PAGE_URL: publicHttpsUrl(config, hosts.app),
		DASHBOARD_URL: publicHttpsUrl(config, hosts.app),
		OPENFGA_API_URL: "http://openfga:8090",
		OPENFGA_STORE_ID: generated.openfga.store_id,
		OPENFGA_MODEL_ID: generated.openfga.model_id,
		OPENFGA_DB_PASSWORD: generated.secrets.openfga_db_password,
		MANAGEMENT_API_URL: oss ? "" : publicHttpsUrl(config, hosts.api, "/api/v1/manage"),
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
		CLICKSTACK_URL: publicHttpsUrl(config, hosts.obs),
		KEYCLOAK_IMAGE_TAG: keycloakImageTag(config.images.keycloak),
		// Is this too hacky? We go Shawn way.
		...(config.vpn?.provider && config.vpn.provider !== "none" && config.vpn.nb_setup_key
			? { NB_SETUP_KEY: config.vpn.nb_setup_key }
			: {}),
	};
}

export function renderEnvFile(env: RuntimeEnv) {
	return Object.entries(env)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join("\n") + "\n";
}

export function renderEnvList(values: Record<string, string | number | boolean>, indent = 6) {
	const prefix = " ".repeat(indent);
	return Object.entries(values)
		.map(([key, value]) => `${prefix}- ${JSON.stringify(`${key}=${String(value)}`)}`)
		.join("\n");
}

export function renderKeycloakRealm(config: DeployConfig, runtimeEnv: RuntimeEnv) {
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

export function renderTraefikDynamicConfig(config: DeployConfig, generated: DeployGeneratedState) {
	const hosts = domainMap(config.domain.root_domain);
	const activeSlot = generated.deployment.active_slot;
	const apiServiceName = generated.deployment.maintenance_mode ? "envsync-api-maintenance" : "envsync-api";
	// Landing is Hosted-only; self-host Swarm omits landing routers (Phase 2).
	const landingEnabled = false;
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
		"    api-router:",
		`      rule: Host(\`${hosts.api}\`)`,
		`      service: ${apiServiceName}`,
		"      entryPoints: [websecure]",
		"      tls:",
		"        certResolver: letsencrypt",
	].join("\n") + "\n";
}

export function renderNginxConf(kind: "web" | "landing") {
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

export function renderApiMaintenanceConf() {
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

export function renderFrontendRuntimeConfig(config: DeployConfig, generated: DeployGeneratedState) {
	const hosts = domainMap(config.domain.root_domain);
	const otelEndpoint = publicHttpsUrl(config, hosts.obs);
	const managementApiEnabled = !isOssConfig(config);
	const activeReleaseVersion = generated.deployment.slots[generated.deployment.active_slot].release_version || config.release.version;
	const apiBaseUrl = publicHttpsUrl(config, hosts.api);
	// Recommended: manage routes live on the core API under /api/v1/manage/{module}/...
	const managementApiUrl = managementApiEnabled ? `${apiBaseUrl.replace(/\/$/, "")}/api/v1/manage` : "";
	const edition = isOssConfig(config) ? "oss" : "enterprise";
	return `window.__ENVSYNC_RUNTIME_CONFIG__ = ${JSON.stringify({
		apiBaseUrl,
		appBaseUrl: publicHttpsUrl(config, hosts.app),
		authBaseUrl: publicHttpsUrl(config, hosts.auth),
		managementApiUrl,
		keycloakRealm: config.auth.keycloak_realm,
		webClientId: config.auth.web_client_id,
		apiDocsUrl: publicHttpsUrl(config, hosts.api, "/docs"),
		edition,
		dashboardVariant: edition,
		managementEnabled: managementApiEnabled,
		// Self-host installs never offer dashboard org-create (program plan §1.1a).
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

function renderNetutilsService(config: DeployConfig) {
	const netutils = config.netutils;
	if (!netutils?.enabled) return "";
	const forwards = Array.isArray(netutils.forwards) ? netutils.forwards : [];
	if (forwards.length === 0) return "";

	const commands = forwards
		.map(forward => {
			const protocol = forward.protocol ?? "tcp";
			if (protocol === "udp") {
				return `socat UDP-LISTEN:${forward.host_port},fork,reuseaddr UDP:${forward.service}:${forward.service_port} &`;
			}
			return `socat TCP-LISTEN:${forward.host_port},fork,reuseaddr TCP:${forward.service}:${forward.service_port} &`;
		})
		.join("\n          ");

	const ports = forwards
		.map(forward => {
			const protocol = forward.protocol ?? "tcp";
			return `      - target: ${forward.host_port}
      published: ${forward.host_port}
      protocol: ${protocol}
      mode: ingress`;
		})
		.join("\n");

	return `
  netutils:
    image: alpine/socat
    command:
      - sh
      - -c
      - |
          set -eu
          ${commands}
          wait
    ports:
${ports}
    networks: [envsync]`;
}

type VpnProvider = NonNullable<DeployConfig["vpn"]>["provider"];

interface VpnServiceRenderResult {
	serviceBlock: string;
	extraVolumes: string[];
}

const VPN_SERVICE_RENDERERS: Record<VpnProvider, (config: DeployConfig, paths: DeployRenderPaths, runtimeEnv: RuntimeEnv) => VpnServiceRenderResult | null> = {
	none: () => null,
	netbird: renderNetbirdService,
};

function renderNetbirdService(config: DeployConfig, paths: DeployRenderPaths, runtimeEnv: RuntimeEnv): VpnServiceRenderResult {
	const nbSetupKey = runtimeEnv.NB_SETUP_KEY ?? "";
	return {
		serviceBlock: `
  netbird_nginx:
    image: ghcr.io/envsync-cloud/netbird-nginx
    cap_add:
      - NET_ADMIN
      - SYS_ADMIN
      - SYS_RESOURCE
    networks: [envsync]
    environment:
${renderEnvList({ NB_SETUP_KEY: nbSetupKey })}
    volumes:
      - netbird_client:/var/lib/netbird
      - ${paths.nginxVpnConf}:/etc/nginx/nginx.conf:ro`,
		// Adding comment for readability, extra volume below. We gotta do something about too many ` bhaiya.
		extraVolumes: ["netbird_client"],
	};
}

function renderVpnService(config: DeployConfig, paths: DeployRenderPaths, runtimeEnv: RuntimeEnv): VpnServiceRenderResult | null {
	const provider = config.vpn?.provider ?? "none";
	const renderer = VPN_SERVICE_RENDERERS[provider];
	if (!renderer) return null;
	return renderer(config, paths, runtimeEnv);
}

export function renderNginxVpnConf(config: DeployConfig) {
	const domain = config.vpn?.internal_domain ?? "envsync.local";
	return `events {}

stream {
  server {
    listen 5432;
    proxy_pass postgres:5432;
  }
  server {
    listen 6379;
    proxy_pass redis:6379;
  }
  server {
    listen 50051;
    proxy_pass minikms:50051;
  }
  server {
    listen 5544;
    proxy_pass minikms_db:5432;
  }
  server {
    listen 8091;
    proxy_pass openfga:8091;
  }
}

http {
  server {
    listen 80;
    server_name keycloak.${domain};
    location / {
      proxy_pass http://keycloak:8080/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
  }
  server {
    listen 80;
    server_name openfga.${domain};
    location / {
      proxy_pass http://openfga:8090/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  server {
    listen 80;
    server_name clickstack.${domain};
    location / {
      proxy_pass http://clickstack:8080/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  server {
    listen 80;
    server_name rustfs.${domain};
    location / {
      proxy_pass http://rustfs:9001/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
`;
}

export function renderOtelAgentConfig(config: DeployConfig) {
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

export function renderClickstackClickHouseConfig() {
	return [
		"<clickhouse>",
		"  <listen_host>0.0.0.0</listen_host>",
		"  <listen_try>1</listen_try>",
		"</clickhouse>",
	].join("\n") + "\n";
}

export function renderStack(
	config: DeployConfig,
	runtimeEnv: RuntimeEnv,
	generated: DeployGeneratedState,
	mode: DeployRenderMode,
	paths: DeployRenderPaths,
) {
	const hosts = domainMap(config.domain.root_domain);
	const includeRuntimeInfra = mode !== "base";
	const includeAppServices = mode === "full";
	const landingEnabled = false;
	const managementEnabled = !isOssConfig(config);
	// License mount is enterprise (management), not tied to landing.
	const apiLicenseVolume = managementEnabled ? "\n    volumes:\n      - /etc/envsync/license:/etc/envsync/license:ro" : "";
	const deployment = createSteadyApiDeploymentState(config, generated);
	const stackName = config.services.stack_name;
	const s3RouterName = `${stackName}-s3-router`;
	const s3ServiceName = `${stackName}-s3-service`;
	const s3ConsoleRouterName = `${stackName}-s3-console-router`;
	const s3ConsoleServiceName = `${stackName}-s3-console-service`;
	const netutilsService = renderNetutilsService(config);
	const vpnResult = renderVpnService(config, paths, runtimeEnv);
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
      - ${paths.traefikStateRoot}:/var/lib/traefik
      - ${paths.deployRoot}:/etc/traefik/dynamic:ro
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
${includeAppServices ? `

  api_maintenance:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_api_maintenance_conf
        target: /etc/nginx/conf.d/default.conf
    networks: [envsync]

${landingEnabled ? `
  landing_nginx:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_landing_conf
        target: /etc/nginx/conf.d/default.conf
    volumes:
      - ${paths.releasesRoot}/landing/current:/srv/landing:ro
    networks: [envsync]` : ""}

  web_nginx:
    image: nginx:1.27-alpine
    configs:
      - source: nginx_web_conf
        target: /etc/nginx/conf.d/default.conf
    volumes:
      - ${paths.releasesRoot}/web/current:/srv/web:ro
    networks: [envsync]

  envsync_api_blue:
    image: ${deployment.slots.blue.api_image || config.images.api}
    environment:
${renderEnvList({
		...apiEnvironment,
		ENVSYNC_DEPLOY_SLOT: "blue",
		ENVSYNC_DEPLOY_RELEASE_VERSION: deployment.slots.blue.release_version || config.release.version,
	})}
${apiLicenseVolume}
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
${apiLicenseVolume}
    networks: [envsync]
    deploy:
      replicas: ${slotHasApiDeployment(deployment.slots.green) ? 1 : 0}` : ""}${netutilsService}${vpnResult?.serviceBlock ?? ""}

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
  ${vpnResult?.extraVolumes.map(v => `
  ${v}:`).join("") ?? ""}

configs:
  keycloak_realm:
    file: ${paths.keycloakRealmFile}
  clickstack_clickhouse_conf:
    file: ${paths.clickstackClickhouseConf}
  otel_agent_conf:
    file: ${paths.otelAgentConf}
${landingEnabled ? `  nginx_landing_conf:
    file: ${paths.nginxLandingConf}
` : ""}
  nginx_web_conf:
    file: ${paths.nginxWebConf}
  nginx_api_maintenance_conf:
    file: ${paths.nginxApiMaintenanceConf}
`.trimStart();
}
