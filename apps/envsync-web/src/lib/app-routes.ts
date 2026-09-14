export const ORG_ACCESS_TABS = ["users", "teams", "roles"] as const;
export type OrgAccessTab = (typeof ORG_ACCESS_TABS)[number];

export const projectsPath = () => "/projects";
export const projectCreatePath = () => "/projects/create";
export const appDetailPath = (appId: string) => `/projects/${appId}`;
export const appSecretsPath = (appId: string) => `/projects/${appId}/secrets`;
export const appManageEnvironmentsPath = (appId: string) =>
  `/projects/${appId}/manage-environments`;
export const appEnvironmentsPath = (appId: string) => `/projects/${appId}/environments`;
export const appAccessPath = (appId: string) => `/projects/${appId}/access`;
export const appApprovalsPath = (appId: string) => `/projects/${appId}/approvals`;
export const appPointInTimePath = (appId: string) => `/projects/${appId}/pit`;
export const appIntegrationsPath = (appId: string) => `/applications/${appId}/integrations`;
export const appIntegrationProviderPath = (appId: string, provider: string) =>
  `${appIntegrationsPath(appId)}/${provider}`;
export const orgPath = () => "/org";
export const orgAccessPath = (tab?: OrgAccessTab) =>
  tab ? `/org/access/${tab}` : "/org/access";
export const orgUsersPath = () => "/org/users";
export const orgTeamsPath = () => "/org/teams";
export const orgRolesPath = () => "/org/roles";
export const orgCertificatesPath = () => "/org/certificates";
export const orgWebhooksPath = () => "/org/webhooks";
export const orgChangeRequestsPath = () => "/org/change-requests";
export const orgSettingsPath = () => "/organisation";
export const orgIntegrationsPath = () => "/organisation/integrations";
export const apiKeysPath = () => "/apikeys";

export const PALETTE_ORG_LINKS = [
  { id: "users", href: orgAccessPath("users") },
  { id: "teams", href: orgAccessPath("teams") },
  { id: "roles", href: orgAccessPath("roles") },
  { id: "apikeys", href: apiKeysPath() },
] as const;

export function isOrgAccessTab(value: string | undefined): value is OrgAccessTab {
  return ORG_ACCESS_TABS.includes(value as OrgAccessTab);
}

export const LEGACY_REDIRECTS: Array<{ id: string; path: string; to: string }> = [
  { id: "legacy-applications", path: "applications", to: "/projects" },
  { id: "legacy-applications-create", path: "applications/create", to: "/projects/create" },
  { id: "legacy-applications-pit-secrets", path: "applications/pit/:appId/secrets", to: "/projects/:appId/pit/secrets" },
  { id: "legacy-applications-pit", path: "applications/pit/:appId", to: "/projects/:appId/pit" },
  { id: "legacy-applications-secrets", path: "applications/:appId/secrets", to: "/projects/:appId/secrets" },
  { id: "legacy-applications-manage-environments", path: "applications/:appId/manage-environments", to: "/projects/:appId/manage-environments" },
  { id: "legacy-applications-access", path: "applications/:appId/access", to: "/projects/:appId/access" },
  { id: "legacy-applications-detail", path: "applications/:appId", to: "/projects/:appId" },
  { id: "legacy-users", path: "users", to: "/org/users" },
  { id: "legacy-teams", path: "teams", to: "/org/teams" },
  { id: "legacy-roles", path: "roles", to: "/org/roles" },
  { id: "legacy-certificates", path: "certificates", to: "/org/certificates" },
  { id: "legacy-webhooks", path: "webhooks", to: "/org/webhooks" },
  { id: "legacy-change-requests", path: "change-requests", to: "/org/change-requests" },
];

export function applyRouteParams(pattern: string, params: Record<string, string | undefined>) {
  return pattern.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params[key];
    return value ? encodeURIComponent(value) : "";
  });
}
