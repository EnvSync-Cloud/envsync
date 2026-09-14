/** Canonical dashboard paths for UI e2e. Legacy URLs stay only in routes.spec.ts. */

export const uiPaths = {
	projects: () => "/projects",
	projectCreate: () => "/projects/create",
	project: (appId: string) => `/projects/${appId}`,
	projectSecrets: (appId: string) => `/projects/${appId}/secrets`,
	projectVariables: (appId: string, envTypeId?: string) =>
		envTypeId
			? `/projects/${appId}?selected=${encodeURIComponent(envTypeId)}`
			: `/projects/${appId}`,
	projectSecretsSelected: (appId: string, envTypeId: string) =>
		`/projects/${appId}/secrets?selected=${encodeURIComponent(envTypeId)}`,
	projectEnvironments: (appId: string) => `/projects/${appId}/manage-environments`,
	projectAccess: (appId: string) => `/projects/${appId}/access`,
	projectPit: (appId: string) => `/projects/${appId}/pit`,
	projectPitSecrets: (appId: string) => `/projects/${appId}/pit/secrets`,
	projectIntegrations: (appId: string) => `/projects/${appId}/integrations`,
	orgAccess: (tab: "users" | "teams" | "roles" = "users") => `/org/access/${tab}`,
	orgChangeRequests: () => "/org/change-requests",
	orgSettings: () => "/org",
} as const;
