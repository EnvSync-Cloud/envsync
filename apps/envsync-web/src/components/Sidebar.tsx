import { LogOut, Menu, ChevronLeft, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { navGroups } from "@/constants";
import { useAuthContext } from "@/contexts/auth";
import { logoutWebSession } from "@/api";
import { runtimeConfig } from "@/utils/runtime-config";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ expanded, onToggle }: SidebarProps) => {
  const { user, allowedScopes } = useAuthContext();
  const { pathname } = useLocation();

  const authorizedGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => allowedScopes.includes(item.id)),
        }))
        .filter((group) => group.items.length > 0),
    [allowedScopes]
  );

  const handleLogout = async () => {
    try {
      await logoutWebSession();
    } catch (error) {
      console.error("Failed to logout cleanly:", error);
    }
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col overflow-hidden border-r border-border bg-background transition-all duration-300 ease-in-out",
        expanded ? "w-64" : "w-16"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <div className="flex-shrink-0 border-b border-border px-4 py-5">
        <div className="flex items-center justify-between">
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
            {expanded ? (
              <ChevronLeft className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-clip px-2 py-4">
        {authorizedGroups.map((group, groupIdx) => (
          <div key={group.label}>
            {expanded ? (
              <div className="mb-2 px-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-tertiary">
                  {group.label}
                </span>
              </div>
            ) : (
              groupIdx > 0 && (
                <div className="mx-3 mb-2 border-t border-border" />
              )
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <div key={item.id} className="relative group">
                    <Link
                      to={item.href}
                      className={cn(
                        "relative flex w-full items-center rounded-2xl text-left text-sm font-medium transition-all duration-200",
                        expanded
                          ? "gap-3 px-3 py-2.5"
                          : "justify-center px-2 py-2.5",
                        isActive
                          ? "border border-primary/20 bg-primary/12 text-foreground"
                          : "border border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground"
                      )}
                      title={!expanded ? item.name : undefined}
                    >
                        <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                          isActive
                            ? "bg-primary/18 text-primary"
                            : "bg-secondary text-muted-foreground group-hover:text-foreground"
                        )}
                      >
                        <Icon className="size-[18px]" />
                      </span>
                      {expanded && (
                        <div className="min-w-0">
                          <span className="block truncate transition-opacity duration-200">
                            {item.name}
                          </span>
                        </div>
                      )}
                    </Link>

                    {!expanded && (
                      <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-popover px-2.5 py-1.5 text-xs text-foreground opacity-0 invisible backdrop-blur-sm transition-all duration-150 group-hover:visible group-hover:opacity-100">
                        {item.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {expanded && (
        <div className="px-4 pb-2">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-shortcuts-dialog"));
            }}
            className="flex w-full items-center space-x-2 rounded-2xl border border-border bg-secondary/50 px-3 py-2 text-xs text-tertiary transition-colors hover:bg-primary/5 hover:text-primary"
          >
            <Keyboard className="size-3.5" />
            <span>Keyboard shortcuts</span>
            <kbd className="ml-auto text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
              ?
            </kbd>
          </button>
        </div>
      )}

      {user && (
        <div className="flex-shrink-0 border-t border-border p-3">
          <div
            className={cn(
              "flex items-center transition-all duration-300",
              expanded ? "space-x-3" : "justify-center"
            )}
          >
            <div className="relative flex-shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-muted">
                {user.user.profile_picture_url ? (
                  <img
                    src={user.user.profile_picture_url}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-foreground font-medium text-sm">
                    {user.user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary animate-pulse" />
            </div>

            {expanded && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.user.full_name ?? ""}
                </p>
                <p className="hdx-mask text-[11px] text-tertiary truncate">
                  {user.user.email ?? ""}
                </p>
                {runtimeConfig.releaseVersion && (
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                    {`v${runtimeConfig.releaseVersion}`}
                    {runtimeConfig.activeApiSlot ? ` · slot ${runtimeConfig.activeApiSlot}` : ""}
                  </p>
                )}
              </div>
            )}

            {expanded && (
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-1.5 text-tertiary transition-colors hover:bg-muted hover:text-foreground"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover backdrop-blur-sm text-foreground text-xs rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 top-1/2 -translate-y-1/2 border border-primary/20">
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
