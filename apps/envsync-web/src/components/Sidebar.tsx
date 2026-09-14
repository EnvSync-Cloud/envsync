import { ChevronLeft, Keyboard, Menu } from "lucide-react";

import { ContextNav } from "@/components/shell/ContextNav";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import { ProductSwitcher } from "@/components/shell/ProductSwitcher";
import { ProjectSwitcher } from "@/components/shell/ProjectSwitcher";
import { useAuthContext } from "@/contexts/auth";
import type { ProductId } from "@/lib/shell-context";
import { cn } from "@/lib/utils";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
  product: ProductId;
  appId: string | null;
  projects: Array<{ id: string; name: string }>;
}

export const Sidebar = ({
  expanded,
  onToggle,
  product,
  appId,
  projects,
}: SidebarProps) => {
  const { allowedScopes } = useAuthContext();
  const showProjectSwitcher = product === "secrets";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-border bg-background transition-all duration-300 ease-in-out",
        expanded ? "w-64" : "w-16",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="flex-shrink-0 border-b border-border px-3 py-4">
        <div className={cn("flex items-center", expanded ? "justify-between" : "flex-col gap-2")}>
          <div className={cn("flex items-center", expanded ? "gap-3" : "justify-center")}>
            <div className="flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
              <img src="/EnvSync.svg" alt="EnvSync" className="size-8" />
            </div>
            {expanded && (
              <div className="min-w-0">
                <p className="text-sm font-medium tracking-wide text-foreground">EnvSync</p>
              </div>
            )}
          </div>
          <button
            onClick={onToggle}
            className="rounded-xl p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
          >
            {expanded ? <ChevronLeft className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 space-y-2 border-b border-border px-2 py-3">
        <OrgSwitcher expanded={expanded} />
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
      />

      {expanded && (
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-shortcuts-dialog"));
            }}
            className="flex w-full items-center space-x-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-xs text-tertiary transition-colors hover:bg-primary/5 hover:text-primary"
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
