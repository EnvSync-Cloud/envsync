import type { ApiModule } from "./types";

export const coreApiModules: ApiModule[] = [
	{
		name: "access",
		mountPath: "/access",
		createRouter: async () => (await import("@/routes/access.route")).default,
	},
	{
		name: "app",
		mountPath: "/app",
		createRouter: async () => (await import("@/routes/app.route")).default,
	},
	{
		name: "api_key",
		mountPath: "/api_key",
		createRouter: async () => (await import("@/routes/api_key.route")).default,
	},
	{
		name: "audit_log",
		mountPath: "/audit_log",
		createRouter: async () => (await import("@/routes/audit_log.route")).default,
	},
	{
		name: "auth",
		mountPath: "/auth",
		createRouter: async () => (await import("@/routes/auth.route")).default,
	},
	{
		name: "env_type",
		mountPath: "/env_type",
		createRouter: async () => (await import("@/routes/env_type.route")).default,
	},
	{
		name: "env",
		mountPath: "/env",
		createRouter: async () => (await import("@/routes/env.route")).default,
	},
	{
		name: "role",
		mountPath: "/role",
		createRouter: async () => (await import("@/routes/role.route")).default,
	},
	{
		name: "org",
		mountPath: "/org",
		createRouter: async () => (await import("@/routes/org.route")).default,
	},
	{
		name: "onboarding",
		mountPath: "/onboarding",
		createRouter: async () => (await import("@/routes/onboarding.route")).default,
	},
	{
		name: "secret",
		mountPath: "/secret",
		createRouter: async () => (await import("@/routes/secret.route")).default,
	},
	{
		name: "upload",
		mountPath: "/upload",
		createRouter: async () => (await import("@/routes/upload.route")).default,
	},
	{
		name: "user",
		mountPath: "/user",
		createRouter: async () => (await import("@/routes/user.route")).default,
	},
	{
		name: "team",
		mountPath: "/team",
		createRouter: async () => (await import("@/routes/team.route")).default,
	},
	{
		name: "permission",
		mountPath: "/permission",
		createRouter: async () => (await import("@/routes/permission.route")).default,
	},
	{
		name: "webhook",
		mountPath: "/webhook",
		createRouter: async () => (await import("@/routes/webhook.route")).default,
	},
	{
		name: "gpg_key",
		mountPath: "/gpg_key",
		createRouter: async () => (await import("@/routes/gpg_key.route")).default,
	},
	{
		name: "certificate",
		mountPath: "/certificate",
		createRouter: async () => (await import("@/routes/certificate.route")).default,
	},
	{
		name: "change_request",
		mountPath: "/change_request",
		createRouter: async () => (await import("@/routes/change_request.route")).default,
	},
	{
		name: "service_token",
		mountPath: "/service_token",
		createRouter: async () => (await import("@/routes/service_token.route")).default,
	},
	{
		name: "system",
		mountPath: "/system",
		createRouter: async () => (await import("@/routes/system.route")).default,
	},
	{
		// Operator self-host org create (Phase 1b). Auth: X-EnvSync-Setup-Token only.
		name: "setup",
		mountPath: "/setup",
		createRouter: async () => (await import("@/routes/setup.route")).default,
	},
];
