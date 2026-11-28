/**
 * Feature → hosted documentation mapping for the dashboard.
 *
 * Keys are the ids already used by the module registry (`navGroups` items,
 * project settings tabs), so core and enterprise dashboard modules resolve
 * through one map without importing each other.
 *
 * A feature with no entry gets no "Learn more" link. `UNDOCUMENTED_FEATURE_IDS`
 * records that gap explicitly, and the companion test fails if a new nav item
 * is added without deciding.
 */

export const DOCS_BASE = "https://docs.envsync.cloud";

/** Published docs pages, kept as an allowlist so a typo cannot invent a 404. */
export const DOCS_PAGES = {
  overview: "/envsync",
  secretsAndVariables: "/envsync/core-concepts/secrets-and-variables",
  accessControl: "/envsync/core-concepts/access-control",
  changeRequests: "/envsync/core-concepts/approvals-and-change-requests",
  systemOverview: "/envsync/architecture/system-overview",
  atriumAndAuth: "/envsync/architecture/atrium-and-auth",
  monorepo: "/envsync/architecture/monorepo-structure",
  selfHosting: "/envsync/self-hosting/overview",
  deployCli: "/envsync/self-hosting/deploy-cli",
  operationsAndBackups: "/envsync/self-hosting/operations-and-backups",
  sdks: "/envsync/integrations/sdks",
  cicd: "/envsync/integrations/ci-cd",
  logForwarding: "/envsync/integrations/log-forwarding",
  contributing: "/envsync/developer/contributing",
  testing: "/envsync/developer/testing",
  encryptionAndKms: "/envsync/security/encryption-and-kms",
  auditLogging: "/envsync/security/audit-logging",
  certificates: "/envsync/security/certificates",
  gpgKeys: "/envsync/security/gpg-keys",
  teams: "/envsync/core-concepts/teams",
  webhooks: "/envsync/integrations/webhooks",
  organizationSettings: "/envsync/dashboard/organization-settings",
  projectSettings: "/envsync/dashboard/project-settings",
  accountSettings: "/envsync/dashboard/account-settings",
  license: "/envsync/dashboard/license",
  providerIntegrations: "/envsync/integrations/provider-integrations",
  syncOperations: "/envsync/integrations/sync-operations",
  secretRotation: "/envsync/core-concepts/secret-rotation",
  dynamicSecrets: "/envsync/core-concepts/dynamic-secrets",
} as const;

const docsUrl = (page: keyof typeof DOCS_PAGES, anchor?: string) =>
  `${DOCS_BASE}${DOCS_PAGES[page]}${anchor ? `#${anchor}` : ""}`;

/** Docs page per sidebar nav item id (project ids come from `buildProjectNavItems`). */
export const NAV_DOCS: Record<string, string> = {
  // Core sidebar
  dashboard: docsUrl("overview"),
  applications: docsUrl("secretsAndVariables", "hierarchy-model"),
  apikeys: docsUrl("accessControl", "api-keys"),
  users: docsUrl("accessControl", "organization-relations"),
  roles: docsUrl("accessControl", "organization-relations"),
  "change-requests": docsUrl("changeRequests"),
  audit: docsUrl("auditLogging"),
  certificates: docsUrl("certificates"),
  gpgkeys: docsUrl("gpgKeys"),
  teams: docsUrl("teams"),
  webhooks: docsUrl("webhooks"),
  settings: docsUrl("accountSettings"),
  organisation: docsUrl("organizationSettings"),

  // Project sidebar
  "project-variables": docsUrl("secretsAndVariables"),
  "project-secrets": docsUrl("secretsAndVariables", "secret-encryption--storage"),
  "project-environments": docsUrl("secretsAndVariables", "hierarchy-model"),
  "project-recovery": docsUrl("secretsAndVariables", "point-in-time-history"),
  "project-access": docsUrl("accessControl", "organization-relations"),
  "project-approvals": docsUrl("changeRequests"),
  "project-settings": docsUrl("projectSettings"),
  "applications-integrations": docsUrl("providerIntegrations"),

  // Enterprise sidebar
  "organisation-sso": docsUrl("atriumAndAuth", "saml-and-workload-oidc"),
  "organisation-oidc": docsUrl("accessControl", "workload-oidc"),
  "organisation-log-forwarding": docsUrl("logForwarding"),
  "organisation-keys": docsUrl("encryptionAndKms"),
  "organisation-integrations": docsUrl("providerIntegrations"),
  "organisation-sync": docsUrl("syncOperations"),
  "organisation-license": docsUrl("license"),
  "organisation-dynamic-secrets": docsUrl("dynamicSecrets"),
};

/** Docs page per project settings tab id. */
export const SETTINGS_TAB_DOCS: Record<string, string> = {
  tokens: docsUrl("accessControl", "service-tokens"),
  rotation: docsUrl("secretRotation"),
  "dynamic-secrets": docsUrl("dynamicSecrets"),
};

/**
 * Dashboard surfaces with no explanatory page on docs.envsync.cloud. Every nav
 * item and settings tab is now mapped, so this list is empty — keep it that way:
 * add a nav id here only if the docs site genuinely has no page for it.
 */
export const UNDOCUMENTED_FEATURE_IDS: readonly string[] = [];

/** Ordered pathname → docs page rules, used for the page header button. */
const PATHNAME_DOCS: ReadonlyArray<{ pattern: RegExp; url: string }> = [
  { pattern: /^\/$/, url: docsUrl("overview") },
  { pattern: /^\/dashboard$/, url: docsUrl("overview") },
  { pattern: /^\/projects\/[^/]+\/secrets$/, url: docsUrl("secretsAndVariables", "secret-encryption--storage") },
  { pattern: /^\/projects\/[^/]+\/pit/, url: docsUrl("secretsAndVariables", "point-in-time-history") },
  { pattern: /^\/projects\/[^/]+\/environments$/, url: docsUrl("secretsAndVariables", "hierarchy-model") },
  { pattern: /^\/projects\/[^/]+\/manage-environments$/, url: docsUrl("secretsAndVariables", "hierarchy-model") },
  { pattern: /^\/projects\/[^/]+\/access$/, url: docsUrl("accessControl", "organization-relations") },
  { pattern: /^\/projects\/[^/]+\/approvals$/, url: docsUrl("changeRequests") },
  { pattern: /^\/projects\/[^/]+\/settings\/service-tokens$/, url: docsUrl("accessControl", "service-tokens") },
  { pattern: /^\/projects\/[^/]+\/settings\/rotation$/, url: docsUrl("secretRotation") },
  { pattern: /^\/projects\/[^/]+\/settings\/dynamic-secrets$/, url: docsUrl("dynamicSecrets") },
  { pattern: /^\/projects\/[^/]+\/integrations\/[^/]+$/, url: docsUrl("providerIntegrations") },
  { pattern: /^\/projects\/[^/]+\/integrations$/, url: docsUrl("providerIntegrations") },
  { pattern: /^\/projects\/[^/]+\/settings$/, url: docsUrl("projectSettings") },
  { pattern: /^\/projects\/[^/]+$/, url: docsUrl("secretsAndVariables") },
  { pattern: /^\/projects\/create$/, url: docsUrl("secretsAndVariables", "hierarchy-model") },
  { pattern: /^\/projects$/, url: docsUrl("secretsAndVariables", "hierarchy-model") },
  { pattern: /^\/apikeys$/, url: docsUrl("accessControl", "api-keys") },
  { pattern: /^\/org\/access\/roles$/, url: docsUrl("accessControl", "organization-relations") },
  { pattern: /^\/org\/access\/users$/, url: docsUrl("accessControl", "organization-relations") },
  { pattern: /^\/org\/access\/teams$/, url: docsUrl("teams") },
  { pattern: /^\/org\/change-requests$/, url: docsUrl("changeRequests") },
  { pattern: /^\/org\/certificates$/, url: docsUrl("certificates") },
  { pattern: /^\/org\/webhooks$/, url: docsUrl("webhooks") },
  { pattern: /^\/org$/, url: docsUrl("organizationSettings") },
  { pattern: /^\/gpgkeys$/, url: docsUrl("gpgKeys") },
  { pattern: /^\/settings$/, url: docsUrl("accountSettings") },
  { pattern: /^\/audit$/, url: docsUrl("auditLogging") },
  { pattern: /^\/organisation\/sso$/, url: docsUrl("atriumAndAuth", "saml-and-workload-oidc") },
  { pattern: /^\/organisation\/oidc$/, url: docsUrl("accessControl", "workload-oidc") },
  { pattern: /^\/organisation\/log-forwarding$/, url: docsUrl("logForwarding") },
  { pattern: /^\/organisation\/keys$/, url: docsUrl("encryptionAndKms") },
  { pattern: /^\/organisation\/license$/, url: docsUrl("license") },
  { pattern: /^\/organisation\/integrations$/, url: docsUrl("providerIntegrations") },
  { pattern: /^\/organisation\/sync$/, url: docsUrl("syncOperations") },
  { pattern: /^\/organisation\/dynamic-secrets$/, url: docsUrl("dynamicSecrets") },
];

export function docsUrlForNavItem(navId: string): string | undefined {
  return NAV_DOCS[navId];
}

export function docsUrlForSettingsTab(tabId: string): string | undefined {
  return SETTINGS_TAB_DOCS[tabId];
}

export function docsUrlForPathname(pathname: string): string | undefined {
  return PATHNAME_DOCS.find(({ pattern }) => pattern.test(pathname))?.url;
}
