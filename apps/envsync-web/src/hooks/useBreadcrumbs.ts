import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@/api/base";
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
  access: "Access",
  integrations: "Integrations",
  pit: "Recovery",
  roles: "Roles",
  users: "Users",
  settings: "Account",
  organisation: "Organisation",
  audit: "Activity",
  apikeys: "API Keys",
  webhooks: "Webhooks",
  gpgkeys: "GPG Keys",
  certificates: "Certificates",
  dashboard: "Dashboard",
  teams: "Teams",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useBreadcrumbs(): Breadcrumb[] {
  const { pathname } = useLocation();

  const { data: apps } = useQuery({
    queryKey: ["breadcrumb-apps"],
    queryFn: async () => {
      const appsData = await sdk.applications.getApps();
      return appsData.map((app) => ({
        id: app.id,
        name: app.name,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

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

    if (segments.length >= 2 && segments[0] === "applications") {
      const isAppDetailPage = UUID_REGEX.test(segments[1]) || apps?.some(
        (a) => a.name === segments[1] || `${a.name}-${a.id}` === segments[1]
      );
      
      if (isAppDetailPage) {
        const subSection = segments[2];
        const knownSubSections = ["secrets", "manage-environments", "access", "integrations", "pit"];
        
        if (!subSection || !knownSubSections.includes(subSection)) {
          crumbs.push({ label: "Variables", href: currentPath });
        }
      }
    }

    return crumbs;
  }, [pathname, apps]);
}
