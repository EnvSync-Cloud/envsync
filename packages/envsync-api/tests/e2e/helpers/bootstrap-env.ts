import fs from "node:fs";
import path from "node:path";

let bootstrapped = false;

export function ensureE2EEnv(): void {
	if (bootstrapped) return;
	bootstrapped = true;

	process.env.SKIP_ROOT_ENV = "1";

	const projectRoot = findProjectRoot();
	const envE2EPath = path.join(projectRoot, ".env.e2e.test");
	if (fs.existsSync(envE2EPath)) {
		loadEnvFileSimple(envE2EPath);
		console.log(`[E2E Setup] Loaded credentials from ${envE2EPath}`);
	} else {
		console.log(`[E2E Setup] WARNING: ${envE2EPath} not found. Run 'bun run e2e:init' first.`);
	}

	const keycloakUrl = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
	Object.assign(process.env, {
		NODE_ENV: "development",
		PORT: process.env.PORT ?? "0",
		DB_LOGGING: "false",
		DB_AUTO_MIGRATE: "true",
		DATABASE_SSL: "false",
		DATABASE_HOST: process.env.DATABASE_HOST ?? "localhost",
		DATABASE_PORT: process.env.DATABASE_PORT ?? "5432",
		DATABASE_USER: process.env.DATABASE_USER ?? "postgres",
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? "postgres",
		DATABASE_NAME: process.env.DATABASE_NAME ?? "envsync_e2e_test",
		S3_BUCKET: process.env.S3_BUCKET ?? "envsync-bucket",
		S3_REGION: process.env.S3_REGION ?? "us-east-1",
		S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "rustfsadmin",
		S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "rustfsadmin",
		S3_BUCKET_URL: process.env.S3_BUCKET_URL ?? "http://localhost:19000/envsync-bucket",
		S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:19000",
		CACHE_ENV: "development",
		SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
		SMTP_PORT: process.env.SMTP_PORT ?? "1025",
		SMTP_SECURE: "false",
		SMTP_FROM: process.env.SMTP_FROM ?? "test@envsync.local",
		KEYCLOAK_URL: keycloakUrl,
		KEYCLOAK_REALM: process.env.KEYCLOAK_REALM ?? "envsync",
		KEYCLOAK_ADMIN_USER: process.env.KEYCLOAK_ADMIN_USER ?? "admin",
		KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin",
		KEYCLOAK_WEB_CLIENT_ID: process.env.KEYCLOAK_WEB_CLIENT_ID ?? "envsync-web",
		KEYCLOAK_WEB_CLIENT_SECRET: process.env.KEYCLOAK_WEB_CLIENT_SECRET ?? "test-web-client-secret",
		KEYCLOAK_CLI_CLIENT_ID: process.env.KEYCLOAK_CLI_CLIENT_ID ?? "envsync-cli",
		KEYCLOAK_API_CLIENT_ID: process.env.KEYCLOAK_API_CLIENT_ID ?? "envsync-api",
		KEYCLOAK_API_CLIENT_SECRET: process.env.KEYCLOAK_API_CLIENT_SECRET ?? "test-api-client-secret",
		KEYCLOAK_WEB_REDIRECT_URI: process.env.KEYCLOAK_WEB_REDIRECT_URI ?? "http://api.lvh.me:4000/api/access/web/callback",
		KEYCLOAK_WEB_CALLBACK_URL: process.env.KEYCLOAK_WEB_CALLBACK_URL ?? "http://app.lvh.me:8001/auth/callback",
		KEYCLOAK_API_REDIRECT_URI: process.env.KEYCLOAK_API_REDIRECT_URI ?? "http://api.lvh.me:4000/api/access/api/callback",
		OPENFGA_API_URL: process.env.OPENFGA_API_URL ?? "http://localhost:8090",
		OPENFGA_STORE_ID: process.env.OPENFGA_STORE_ID ?? "",
		OPENFGA_MODEL_ID: process.env.OPENFGA_MODEL_ID ?? "",
		MINIKMS_GRPC_ADDR: process.env.MINIKMS_GRPC_ADDR ?? "localhost:50051",
		MINIKMS_TLS_ENABLED: "false",
		LANDING_PAGE_URL: process.env.LANDING_PAGE_URL ?? "http://localhost:8002",
		DASHBOARD_URL: process.env.DASHBOARD_URL ?? "http://app.lvh.me:8001",
		ENVSYNC_EDITION: process.env.ENVSYNC_EDITION ?? "enterprise",
		API_URL: process.env.API_URL ?? "http://api.lvh.me:4000",
	});
}

function findProjectRoot(): string {
	let dir = path.resolve(import.meta.dir, "../../..");
	for (;;) {
		if (fs.existsSync(path.join(dir, "package.json"))) {
			try {
				const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
				if (pkg.name === "envsync-api") return dir;
			} catch {}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return path.resolve(import.meta.dir, "../../..");
}

function loadEnvFileSimple(filePath: string): void {
	const content = fs.readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		if (key) process.env[key] = value;
	}
}
