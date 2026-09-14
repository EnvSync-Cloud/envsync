import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sdk } from "@/api/base";
import { useMemo } from "react";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";

export type { Breadcrumb } from "@/lib/breadcrumbs";
export { buildBreadcrumbs, isProjectIdSegment, labelForSegment } from "@/lib/breadcrumbs";

export function useBreadcrumbs() {
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

  return useMemo(() => buildBreadcrumbs(pathname, apps), [pathname, apps]);
}
