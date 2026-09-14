export interface Breadcrumb {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  applications: "Projects",
  projects: "Projects",
  create: "Create Project",
  secrets: "Secrets",
  "manage-environments": "Environments",
  environments: "Environments",
  access: "Access",
  approvals: "Approvals",
  "service-tokens": "Service Tokens",
  integrations: "Integrations",
  pit: "Recovery",
  roles: "Roles",
  users: "Users",
  settings: "Account",
  org: "Organization",
  organisation: "Organization",
  sso: "SSO",
  license: "License",
  keys: "Key management",
  sync: "Sync ops",
  audit: "Activity",
  apikeys: "API Keys",
  webhooks: "Webhooks",
  gpgkeys: "GPG Keys",
  certificates: "Certificates",
  dashboard: "Dashboard",
  teams: "Teams",
  "change-requests": "Change Requests",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function labelForSegment(segment: string) {
  return ROUTE_LABELS[segment];
}

export function isProjectIdSegment(segment: string) {
  return UUID_REGEX.test(segment);
}

export function buildBreadcrumbs(
  pathname: string,
  apps?: Array<{ id: string; name: string }> | null,
): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Dashboard", href: "/" }];
  }

  const crumbs: Breadcrumb[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    const isProjectSettings =
      segment === "settings" && (segments[0] === "projects" || segments[0] === "applications");

    if (isProjectSettings) {
      crumbs.push({ label: "Settings", href: currentPath });
    } else if (ROUTE_LABELS[segment]) {
      crumbs.push({ label: ROUTE_LABELS[segment], href: currentPath });
    } else if (UUID_REGEX.test(segment) && apps) {
      const match = apps.find((a) => a.id === segment);
      crumbs.push({ label: match?.name ?? segment, href: currentPath });
    } else {
      const match = apps?.find(
        (a) => a.name === segment || `${a.name}-${a.id}` === segment
      );
      crumbs.push({ label: match?.name ?? segment, href: currentPath });
    }
  }

  const projectRoot = segments[0] === "applications" || segments[0] === "projects";
  if (segments.length >= 2 && projectRoot && segments[1] !== "create" && segments[1] !== "pit") {
    const isAppDetailPage = UUID_REGEX.test(segments[1]) || apps?.some(
      (a) => a.name === segments[1] || `${a.name}-${a.id}` === segments[1]
    );

    if (isAppDetailPage) {
      const subSection = segments[2];
      const knownSubSections = [
        "secrets",
        "manage-environments",
        "environments",
        "access",
        "approvals",
        "change-requests",
        "settings",
        "integrations",
        "pit",
      ];

      if (!subSection || !knownSubSections.includes(subSection)) {
        crumbs.push({ label: "Variables", href: currentPath });
      }
    }
  }

  return crumbs;
}
