import path from "node:path";
import { fileURLToPath } from "node:url";

export type UiRole = "master" | "admin" | "editor" | "viewer";

export interface RoleCredential {
	email: string;
	password: string;
	fullName: string;
	seedRole: string;
}

export interface UiHarnessConfig {
	appDir: string;
	baseUrl: string;
	landingUrl: string;
	apiBaseUrl: string;
	authUrl: string;
	mailpitUrl: string;
	actionTimeoutMs: number;
	loginTimeoutMs: number;
	mailpitPollTimeoutMs: number;
	mailpitPollIntervalMs: number;
	headless: boolean;
	slowMoMs: number;
	freshLogin: boolean;
	keepOpen: boolean;
	allowLocalAutologin: boolean;
	includeDestructive: boolean;
	storageDir: string;
	artifactsDir: string;
	testPassword: string;
	testEmailDomain: string;
	roleCredentials: Record<UiRole, RoleCredential>;
}

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(helperDir, "..", "..");
const tmpDir = path.resolve(appDir, ".tmp");

export const VIEWPORT = { width: 1600, height: 1000 } as const;

export function getUiHarnessConfig(): UiHarnessConfig {
	return {
		appDir,
		baseUrl: process.env.ENVSYNC_UI_BASE_URL ?? "http://app.lvh.me:8001",
		landingUrl: process.env.ENVSYNC_UI_LANDING_URL ?? "http://localhost:8002",
		apiBaseUrl: process.env.ENVSYNC_UI_API_BASE_URL ?? "http://api.lvh.me:4000",
		authUrl: process.env.ENVSYNC_UI_AUTH_URL ?? "http://auth.lvh.me:8080",
		mailpitUrl: process.env.ENVSYNC_UI_MAILPIT_URL ?? "http://localhost:8025",
		actionTimeoutMs: Number(process.env.ENVSYNC_UI_ACTION_TIMEOUT_MS ?? "30000"),
		loginTimeoutMs: Number(process.env.ENVSYNC_UI_LOGIN_TIMEOUT_MS ?? "180000"),
		mailpitPollTimeoutMs: Number(process.env.ENVSYNC_UI_MAILPIT_POLL_TIMEOUT_MS ?? "60000"),
		mailpitPollIntervalMs: Number(process.env.ENVSYNC_UI_MAILPIT_POLL_INTERVAL_MS ?? "1000"),
		headless: process.env.ENVSYNC_UI_HEADLESS !== "0",
		slowMoMs: Number(process.env.ENVSYNC_UI_SLOW_MO_MS ?? "0"),
		freshLogin: process.env.ENVSYNC_UI_REQUIRE_FRESH_LOGIN === "1",
		keepOpen: process.env.ENVSYNC_UI_KEEP_OPEN === "1",
		allowLocalAutologin: process.env.ENVSYNC_UI_ALLOW_LOCAL_AUTOLOGIN !== "0",
		includeDestructive: process.env.ENVSYNC_UI_INCLUDE_DESTRUCTIVE === "1",
		storageDir: path.resolve(tmpDir, process.env.ENVSYNC_UI_STORAGE_DIR ?? "auth"),
		artifactsDir: path.resolve(tmpDir, process.env.ENVSYNC_UI_ARTIFACTS_DIR ?? "artifacts"),
		testPassword: process.env.ENVSYNC_UI_TEST_PASSWORD ?? "Test@1234",
		testEmailDomain: process.env.ENVSYNC_UI_TEST_EMAIL_DOMAIN ?? "envsync.local",
		roleCredentials: {
			master: {
				email: "dev@envsync.local",
				password: "Test@1234",
				fullName: "EnvSync Dev",
				seedRole: "master",
			},
			admin: {
				email: "admin-ui@envsync.local",
				password: "Test@1234",
				fullName: "EnvSync Admin",
				seedRole: "admin",
			},
			editor: {
				email: "editor-ui@envsync.local",
				password: "Test@1234",
				fullName: "EnvSync Editor",
				seedRole: "editor",
			},
			viewer: {
				email: "viewer-ui@envsync.local",
				password: "Test@1234",
				fullName: "EnvSync Viewer",
				seedRole: "viewer",
			},
		},
	};
}

export function getStorageStatePath(roleOrKey: UiRole | string) {
	return path.resolve(getUiHarnessConfig().storageDir, `${roleOrKey}.json`);
}

export function getArtifactPath(...segments: string[]) {
	return path.resolve(getUiHarnessConfig().artifactsDir, ...segments);
}

export function uniqueName(prefix: string) {
	const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
	return `${prefix}_${Date.now()}_${suffix}`;
}

export function uniqueSlug(prefix: string) {
	const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
	return `${prefix}-${Date.now()}-${suffix}`.toLowerCase();
}
