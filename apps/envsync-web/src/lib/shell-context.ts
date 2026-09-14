export type ProductId = "secrets" | "certificates" | "organization";

export interface ProductDefinition {
  id: ProductId;
  name: string;
  homeHref: string;
}

export interface ShellContext {
  product: ProductId;
  appId: string | null;
  isProjectRoute: boolean;
}

export const PRODUCTS: ProductDefinition[] = [
  { id: "secrets", name: "Secret Management", homeHref: "/projects" },
  { id: "certificates", name: "Certificates", homeHref: "/org/certificates" },
  { id: "organization", name: "Organization", homeHref: "/org/users" },
];

export const LAST_PROJECT_STORAGE_PREFIX = "envsync-last-project-id";

export function lastProjectStorageKey(orgId: string) {
  return `${LAST_PROJECT_STORAGE_PREFIX}:${orgId}`;
}

const RESERVED_PROJECT_SEGMENTS = new Set(["create", "pit"]);

export function getAppIdFromPath(pathname: string): string | null {
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  if (projectMatch && !RESERVED_PROJECT_SEGMENTS.has(projectMatch[1])) {
    return projectMatch[1];
  }

  const legacyPitMatch = pathname.match(/^\/applications\/pit\/([^/]+)/);
  if (legacyPitMatch) {
    return legacyPitMatch[1];
  }

  const legacyAppMatch = pathname.match(/^\/applications\/([^/]+)/);
  if (legacyAppMatch && !RESERVED_PROJECT_SEGMENTS.has(legacyAppMatch[1])) {
    return legacyAppMatch[1];
  }

  return null;
}

function isCertificatesPath(pathname: string) {
  return (
    pathname === "/certificates"
    || pathname.startsWith("/certificates/")
    || pathname === "/org/certificates"
    || pathname.startsWith("/org/certificates/")
  );
}

function isOrganizationPath(pathname: string) {
  return (
    pathname === "/org"
    || pathname.startsWith("/org/")
    || pathname === "/organisation"
    || pathname.startsWith("/organisation/")
    || pathname === "/users"
    || pathname.startsWith("/users/")
    || pathname === "/teams"
    || pathname.startsWith("/teams/")
    || pathname === "/roles"
    || pathname.startsWith("/roles/")
    || pathname === "/webhooks"
    || pathname.startsWith("/webhooks/")
    || pathname === "/change-requests"
    || pathname.startsWith("/change-requests/")
    || pathname === "/audit"
    || pathname.startsWith("/audit/")
    || pathname === "/apikeys"
    || pathname.startsWith("/apikeys/")
    || pathname === "/gpgkeys"
    || pathname.startsWith("/gpgkeys/")
    || pathname === "/settings"
    || pathname.startsWith("/settings/")
  );
}

export function getShellContext(pathname: string): ShellContext {
  const appId = getAppIdFromPath(pathname);

  if (isCertificatesPath(pathname)) {
    return { product: "certificates", appId, isProjectRoute: appId !== null };
  }

  if (isOrganizationPath(pathname)) {
    return { product: "organization", appId, isProjectRoute: appId !== null };
  }

  return { product: "secrets", appId, isProjectRoute: appId !== null };
}

export function readLastProjectId(orgId?: string | null): string | null {
  if (!orgId) return null;
  try {
    return localStorage.getItem(lastProjectStorageKey(orgId));
  } catch {
    return null;
  }
}

export function writeLastProjectId(orgId: string | null | undefined, appId: string) {
  if (!orgId) return;
  try {
    localStorage.setItem(lastProjectStorageKey(orgId), appId);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function clearLastProjectId(orgId?: string | null) {
  try {
    if (orgId) {
      localStorage.removeItem(lastProjectStorageKey(orgId));
      return;
    }

    localStorage.removeItem(LAST_PROJECT_STORAGE_PREFIX);
    const stale: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key?.startsWith(`${LAST_PROJECT_STORAGE_PREFIX}:`)) {
        stale.push(key);
      }
    }
    for (const key of stale) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore quota / private-mode failures
  }
}

export function secretsHomeHref(projectIds: string[] = [], orgId?: string | null) {
  const lastProjectId = readLastProjectId(orgId);
  if (lastProjectId && projectIds.includes(lastProjectId)) {
    return `/projects/${lastProjectId}`;
  }
  return "/projects";
}

export function productHomeHref(
  product: ProductId,
  projectIds: string[] = [],
  orgId?: string | null,
) {
  if (product === "secrets") return secretsHomeHref(projectIds, orgId);
  const match = PRODUCTS.find((item) => item.id === product);
  return match?.homeHref ?? "/projects";
}

export function isProjectPitPath(pathname: string) {
  return /(?:^|\/)pit(?:\/|$)/.test(pathname);
}
