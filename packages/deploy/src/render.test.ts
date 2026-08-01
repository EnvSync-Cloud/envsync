import { describe, expect, test } from "bun:test";

import {
	buildRuntimeEnv,
	renderApiMaintenanceConf,
	renderClickstackClickHouseConfig,
	renderFrontendRuntimeConfig,
	renderKeycloakRealm,
	renderNginxConf,
	renderNginxVpnConf,
	renderOtelAgentConfig,
	renderStack,
	renderTraefikDynamicConfig,
	type DeployConfig,
	type DeployGeneratedState,
} from "./render";

const config: DeployConfig = {
	source: {
		repo_url: "https://github.com/EnvSync-Cloud/envsync.git",
		ref: "main",
	},
	release: {
		version: "0.8.7",
	},
	domain: {
		root_domain: "enterprise.example.com",
		acme_email: "ops@example.com",
	},
	images: {
		api: "ghcr.io/envsync-cloud/envsync-api:0.8.7",
		management_api: "ghcr.io/envsync-cloud/envsync-management-api:0.8.7",
		keycloak: "envsync-keycloak:0.8.7",
		web: "ghcr.io/envsync-cloud/envsync-web-static:0.8.7",
		landing: "ghcr.io/envsync-cloud/envsync-landing-static:0.8.7",
		clickstack: "ghcr.io/envsync-cloud/clickstack:0.8.7",
		traefik: "traefik:v3.1",
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
		admin_user: "admin",
		admin_password: "admin",
		web_client_id: "envsync-web",
		api_client_id: "envsync-api",
		cli_client_id: "envsync-cli",
	},
	observability: {
		retention_days: 14,
		public_obs: true,
	},
	backup: {
		output_dir: "/backups",
		encrypted: true,
	},
	smtp: {
		host: "smtp.example.com",
		port: 587,
		secure: false,
		user: "smtp-user",
		pass: "smtp-pass",
		from: "ops@example.com",
	},
	exposure: {
		public_auth: true,
		public_obs: true,
		mailpit_enabled: false,
		s3_public: false,
		s3_console_public: false,
	},
	upgrade: {
		maintenance_mode_enabled: true,
		db_snapshot_on_api_upgrade: true,
		keep_failed_upgrade_db_snapshot: true,
	},
	license: {
		server_url: "https://license.envsync.cloud",
		key: "envsync-enterprise-key",
		install_fingerprint: "envsync-b3bb411825372842f0fbdfacde54b5d8",
		lease_ttl_seconds: 300,
	},
	netutils: {
		enabled: false,
		forwards: [],
	},
};

const configWithNetutils: DeployConfig = {
	...config,
	netutils: {
		enabled: true,
		forwards: [
			{ service: "postgres", service_port: 5432, host_port: 15432, protocol: "tcp" },
			{ service: "keycloak", service_port: 8080, host_port: 18080, protocol: "tcp" },
		],
	},
};

const configWithNetbird: DeployConfig = {
	...config,
	vpn: {
		provider: "netbird",
		internal_domain: "infra.envsync.local",
		nb_setup_key: "nb-test-setup-key-abc123",
	},
};

const generated: DeployGeneratedState = {
	openfga: {
		store_id: "store_123",
		model_id: "model_456",
	},
	deployment: {
		active_slot: "blue",
		previous_slot: "green",
		maintenance_mode: false,
		slots: {
			blue: {
				api_image: "ghcr.io/envsync-cloud/envsync-api:0.8.7",
				release_version: "0.8.7",
				deployed_at: "2026-04-30T00:00:00.000Z",
			},
			green: {
				api_image: "ghcr.io/envsync-cloud/envsync-api:0.7.7",
				release_version: "0.7.7",
				deployed_at: "2026-04-29T00:00:00.000Z",
			},
		},
	},
	clickstack: {
		operator_email: "ops@example.com",
		operator_password: "clickstack-pass",
		access_key: "clickstack-access",
		browser_api_key: "browser-api-key",
	},
	secrets: {
		s3_secret_key: "s3-secret-key",
		keycloak_db_password: "keycloak-db-pass",
		keycloak_web_client_secret: "web-client-secret",
		keycloak_api_client_secret: "api-client-secret",
		openfga_db_password: "openfga-db-pass",
		minikms_root_key: "minikms-root-key",
		minikms_db_password: "minikms-db-pass",
	},
	bootstrap: {
		completed_at: "2026-04-30T00:00:00.000Z",
	},
};

const paths = {
	traefikStateRoot: "/var/lib/envsync/traefik",
	deployRoot: "/opt/envsync/deploy",
	releasesRoot: "/opt/envsync/releases",
	keycloakRealmFile: "/opt/envsync/deploy/keycloak-realm.envsync.json",
	clickstackClickhouseConf: "/opt/envsync/deploy/clickhouse-listen.xml",
	otelAgentConf: "/opt/envsync/deploy/otel-agent.yaml",
	nginxLandingConf: "/opt/envsync/deploy/nginx-landing.conf",
	nginxWebConf: "/opt/envsync/deploy/nginx-web.conf",
	nginxApiMaintenanceConf: "/opt/envsync/deploy/nginx-api-maintenance.conf",
	nginxVpnConf: "/opt/envsync/deploy/nginx-vpn.conf",
} as const;

describe("buildRuntimeEnv", () => {
	test("populates enterprise license and standard fields", () => {
		const runtimeEnv = buildRuntimeEnv(config, generated);
		expect(runtimeEnv.KEYCLOAK_WEB_CLIENT_SECRET).toBe("web-client-secret");
		expect(runtimeEnv.OPENFGA_STORE_ID).toBe("store_123");
		expect(runtimeEnv.DASHBOARD_URL).toBe("https://app.enterprise.example.com");
		expect(runtimeEnv.MANAGEMENT_API_URL).toBe("https://manage-api.enterprise.example.com");
		expect(runtimeEnv.ENVSYNC_LICENSE_SERVER_URL).toBe("https://license.envsync.cloud");
		expect(runtimeEnv.ENVSYNC_LICENSE_KEY).toBe("envsync-enterprise-key");
		expect(runtimeEnv.ENVSYNC_INSTALL_FINGERPRINT).toBe("envsync-b3bb411825372842f0fbdfacde54b5d8");
		expect(runtimeEnv.ENVSYNC_LICENSE_LEASE_TTL_SECONDS).toBe("300");
		expect(runtimeEnv.ENVSYNC_STACK_NAME).toBe("envsync");
		expect(runtimeEnv.ENVSYNC_LICENSE_BUNDLE_PATH).toBe("/etc/envsync/license/enterprise-license-bundle.json");
		expect(runtimeEnv.ENVSYNC_LICENSE_CERT_PATH).toBe("/etc/envsync/license/enterprise-cert.pem");
		expect(runtimeEnv.ENVSYNC_LICENSE_KEY_PATH).toBe("/etc/envsync/license/enterprise-key.pem");
		expect(runtimeEnv.ENVSYNC_LICENSE_ROOT_CA_CERT_PATH).toBe("/etc/envsync/license/root-ca.pem");
	});
});

describe("renderStack", () => {
	test("base mode omits landing and api services", () => {
		const runtimeEnv = buildRuntimeEnv(config, generated);
		const stackBase = renderStack(config, runtimeEnv, generated, "base", paths);
		expect(stackBase).not.toContain("landing_nginx");
		expect(stackBase).not.toContain("envsync_api_blue");
	});

	test("full mode includes web, api, and netutils", () => {
		const runtimeEnv = buildRuntimeEnv(config, generated);
		const stackFull = renderStack(configWithNetutils, runtimeEnv, generated, "full", paths);
		// Phase 2: self-host omits landing service
		expect(stackFull).not.toContain("landing_nginx");
		expect(stackFull).toContain("web_nginx");
		expect(stackFull).toContain("envsync_api_blue");
		expect(stackFull).toContain("envsync_api_green");
		expect(stackFull).toContain("envsync-management-api");
		expect(stackFull).toContain("/etc/envsync/license:/etc/envsync/license:ro");
		expect(stackFull).toContain("/opt/envsync/releases/web/current:/srv/web:ro");
		expect(stackFull).not.toContain("/opt/envsync/releases/landing/current:/srv/landing:ro");
		expect(stackFull).toContain("/opt/envsync/deploy/keycloak-realm.envsync.json");
		expect(stackFull).toContain("https://s3.enterprise.example.com/envsync-bucket");
		expect(stackFull).toContain("  netutils:");
		expect(stackFull).toContain("image: alpine/socat");
		expect(stackFull).toContain("socat TCP-LISTEN:15432");
		expect(stackFull).toContain("socat TCP-LISTEN:18080");
		expect(stackFull).toContain("target: 15432");
		expect(stackFull).toContain("target: 18080");
	});
});

describe("renderTraefikDynamicConfig", () => {
	test("sets up traefik routers and hosts correctly", () => {
		const traefik = renderTraefikDynamicConfig(config, generated);
		expect(traefik).toContain("Host(`app.enterprise.example.com`)");
		expect(traefik).toContain("Host(`api.enterprise.example.com`)");
		expect(traefik).toContain("Host(`manage-api.enterprise.example.com`)");
		// Apex landing host is Hosted-only; self-host stack does not route marketing site.
		expect(traefik).not.toContain("Host(`enterprise.example.com`)");
		expect(traefik).toContain("obs.enterprise.example.com");
	});
});

describe("renderKeycloakRealm", () => {
	test("configures realm clients, uris, and attributes", () => {
		const runtimeEnv = buildRuntimeEnv(config, generated);
		const keycloakRealm = renderKeycloakRealm(config, runtimeEnv);
		expect(keycloakRealm).toContain("\"clientId\": \"envsync-web\"");
		expect(keycloakRealm).toContain("https://api.enterprise.example.com/api/access/web/callback");
		expect(keycloakRealm).toContain("https://app.enterprise.example.com/auth/callback");
	});
});

describe("renderFrontendRuntimeConfig", () => {
	test("sets correct runtime URLs and release metadata", () => {
		const frontendRuntime = renderFrontendRuntimeConfig(config, generated);
		expect(frontendRuntime).toContain("https://api.enterprise.example.com");
		expect(frontendRuntime).toContain("\"managementApiUrl\": \"https://manage-api.enterprise.example.com\"");
		expect(frontendRuntime).toContain("\"activeApiSlot\": \"blue\"");
		expect(frontendRuntime).toContain("\"releaseVersion\": \"0.8.7\"");
		expect(frontendRuntime).toContain("\"deploymentMode\": \"selfhosted\"");
		expect(frontendRuntime).toContain("\"canCreateOrganization\": false");
		expect(frontendRuntime).toContain("\"publicSignupEnabled\": false");
	});
});

describe("render helpers for supporting artifacts", () => {
	test("renderNginxConf renders for both web and landing", () => {
		expect(renderNginxConf("web")).toContain("root /srv/web;");
		expect(renderNginxConf("landing")).toContain("root /srv/landing;");
	});

	test("renderApiMaintenanceConf renders 503 error", () => {
		expect(renderApiMaintenanceConf()).toContain("Upgrade in progress. Please retry shortly.");
	});

	test("renderOtelAgentConfig sets correct endpoint", () => {
		expect(renderOtelAgentConfig(config)).toContain("endpoint: http://clickstack:4318");
	});

	test("renderClickstackClickHouseConfig exposes listen host", () => {
		expect(renderClickstackClickHouseConfig()).toContain("<listen_host>0.0.0.0</listen_host>");
	});
});

describe("VPN Configuration (Netbird)", () => {
	test("default config does not include netbird vpn service", () => {
		const runtimeEnv = buildRuntimeEnv(config, generated);
		const stack = renderStack(config, runtimeEnv, generated, "full", paths);
		expect(stack).not.toContain("netbird_nginx");
		expect(stack).not.toContain("netbird_client");
	});

	test("netbird vpn injects service, volume, and mounts nginx-vpn.conf", () => {
		const runtimeEnv = buildRuntimeEnv(configWithNetbird, generated);
		const stack = renderStack(configWithNetbird, runtimeEnv, generated, "full", paths);
		expect(stack).toContain("netbird_nginx:");
		expect(stack).toContain("image: ghcr.io/envsync-cloud/netbird-nginx");
		expect(stack).toContain("NET_ADMIN");
		expect(stack).toContain("SYS_ADMIN");
		expect(stack).toContain("SYS_RESOURCE");
		expect(stack).toContain("netbird_client:/var/lib/netbird");
		expect(stack).toContain("/opt/envsync/deploy/nginx-vpn.conf:/etc/nginx/nginx.conf:ro");
		expect(stack).toContain("NB_SETUP_KEY=");
		expect(stack).toContain("  netbird_client:");
	});

	test("renderNginxVpnConf uses configured internal domain", () => {
		const vpnConf = renderNginxVpnConf(configWithNetbird);
		expect(vpnConf).toContain("server_name keycloak.infra.envsync.local;");
		expect(vpnConf).toContain("server_name openfga.infra.envsync.local;");
		expect(vpnConf).toContain("server_name clickstack.infra.envsync.local;");
		expect(vpnConf).toContain("server_name rustfs.infra.envsync.local;");
		expect(vpnConf).toContain("proxy_pass postgres:5432;");
		expect(vpnConf).toContain("proxy_pass redis:6379;");
		expect(vpnConf).toContain("proxy_pass minikms:50051;");
		expect(vpnConf).toContain("proxy_pass minikms_db:5432;");
		expect(vpnConf).toContain("proxy_pass openfga:8091;");
	});

	test("renderNginxVpnConf defaults to envsync.local", () => {
		const vpnConf = renderNginxVpnConf(config);
		expect(vpnConf).toContain("server_name keycloak.envsync.local;");
		expect(vpnConf).toContain("server_name openfga.envsync.local;");
		expect(vpnConf).toContain("server_name clickstack.envsync.local;");
		expect(vpnConf).toContain("server_name rustfs.envsync.local;");
	});
});
