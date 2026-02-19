import { useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { API_KEYS } from "@/constants";
import { useMemo } from "react";

interface Breadcrumb {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  applications: "Projects",
  create: "Create Project",
  secrets: "Secrets",
  "manage-environments": "Environments",
  pit: "Point-in-Time",
  roles: "Roles",
  users: "Team",
  settings: "Account",
  organisation: "Organisation",
  audit: "Activity",
  apikeys: "API Keys",
  webhooks: "Webhooks",
  gpgkeys: "GPG Keys",
  certificates: "Certificates",
  dashboard: "Dashboard",
};

export function useBreadcrumbs(): Breadcrumb[] {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();

  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      return [{ label: "Dashboard", href: "/" }];
    }

    const crumbs: Breadcrumb[] = [];
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;

      if (ROUTE_LABELS[segment]) {
        crumbs.push({ label: ROUTE_LABELS[segment], href: currentPath });
      } else {
        // Try to resolve dynamic :projectNameId from cache
        let label = segment;
        const apps = queryClient.getQueryData<Array<{ name: string; id: string }>>([
          API_KEYS.ALL_APPLICATIONS,
        ]);
        if (apps) {
          const match = apps.find(
            (a) => a.id === segment || a.name === segment || `${a.name}-${a.id}` === segment
          );
          if (match) {
            label = match.name;
          }
        }
        crumbs.push({ label, href: currentPath });
      }
    }

    return crumbs;
  }, [pathname, queryClient]);
}
