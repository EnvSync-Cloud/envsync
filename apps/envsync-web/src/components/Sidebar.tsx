import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ChevronLeft, Keyboard, Menu } from "lucide-react";

import { sdk } from "@/api/base";
import { ContextNav } from "@/components/shell/ContextNav";
import { ProductSwitcher } from "@/components/shell/ProductSwitcher";
import { ProjectSwitcher } from "@/components/shell/ProjectSwitcher";
import { API_KEYS } from "@/constants";
import { useAuthContext } from "@/contexts/auth";
import { getShellContext, writeLastProjectId } from "@/lib/shell-context";
import { cn } from "@/lib/utils";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export const Sidebar = ({
  expanded,
  onToggle,
}: SidebarProps) => {
  const { pathname } = useLocation();
  const { allowedScopes, user } = useAuthContext();
  const context = getShellContext(pathname);
  const { product, appId } = context;
  const orgId = user?.org?.id;
  const { data: projects = [] } = useQuery({
    queryKey: [API_KEYS.ALL_APPLICATIONS, "shell"],
    queryFn: async () => {
      const appsData = await sdk.applications.getApps();
      return appsData.map((app) => ({
        id: app.id,
        name: app.name,
        enable_secrets: app.enable_secrets ?? false,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (appId) writeLastProjectId(orgId, appId);
  }, [appId, orgId]);

  const showProjectSwitcher = product === "secrets";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        expanded ? "w-64" : "w-16",
      )}
    >
      <div className="flex-shrink-0 border-b border-border px-3 py-4">
        <div className={cn("flex items-center", expanded ? "justify-between" : "flex-col gap-2")}>
          <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
            <img src="/EnvSync.svg" alt="EnvSync" className="size-8" />
            {expanded && (
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-wide text-foreground">EnvSync</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? <ChevronLeft className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 space-y-2 border-b border-border px-2 py-3">
        <ProductSwitcher
          expanded={expanded}
          product={product}
          projectIds={projects.map((project) => project.id)}
        />
        {showProjectSwitcher && (
          <ProjectSwitcher expanded={expanded} appId={appId} projects={projects} />
        )}
      </div>

      <ContextNav
        expanded={expanded}
        product={product}
        appId={appId}
        allowedScopes={allowedScopes}
        secretsEnabled={projects.find((project) => project.id === appId)?.enable_secrets}
      />

      {expanded && (
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-shortcuts-dialog"));
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          >
            <Keyboard className="size-3.5" />
            <span>Keyboard shortcuts</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ?
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
};
