import { Link, useLocation } from "react-router-dom";
import { Database, LayoutDashboard } from "lucide-react";
import { useMemo } from "react";

import { api } from "@/api";
import type { EffectivePermissions } from "@/api/permissions.api";
import { navGroups } from "@/constants";
import { useAuthContext } from "@/contexts/auth";
import { projectsPath } from "@/lib/app-routes";
import { planFlagEnabled } from "@/lib/plan";
import type { ProductId } from "@/lib/shell-context";
import { cn } from "@/lib/utils";
import type { WebNavGroup, WebNavItem } from "@/modules/types";

import {
  buildProjectNavItems,
  hasRequiredPermission,
  isItemActive,
} from "./context-nav";

const SECRETS_ORG_NAV_IDS = new Set(["dashboard", "applications"]);

interface ContextNavProps {
  expanded: boolean;
  product: ProductId;
  appId: string | null;
  allowedScopes: string[];
  /** False hides the project Secrets item. Unset keeps it visible while the project is loading. */
  secretsEnabled?: boolean;
}

function NavLink({
  item,
  expanded,
  pathname,
}: {
  item: WebNavItem;
  expanded: boolean;
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = isItemActive(pathname, item.href);

  return (
    <div className="relative group">
      <Link
        to={item.href}
        data-testid={`shell-nav-${item.id}`}
        className={cn(
          "relative flex w-full items-center rounded-lg text-left text-sm transition-colors",
          expanded ? "gap-2.5 px-2.5 py-1.5" : "justify-center px-2 py-1.5",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
        )}
        title={!expanded ? item.name : undefined}
      >
        <Icon className="size-4 shrink-0" />
        {expanded && (
          <span className="block min-w-0 truncate">{item.name}</span>
        )}
      </Link>
      {!expanded && (
        <div className="invisible absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
          {item.name}
        </div>
      )}
    </div>
  );
}

function NavGroup({
  group,
  expanded,
  pathname,
}: {
  group: WebNavGroup;
  expanded: boolean;
  pathname: string;
}) {
  if (group.items.length === 0) return null;

  return (
    <div>
      {expanded ? (
        <div className="mb-2 px-3">
          <span className="text-xs text-muted-foreground">
            {group.label}
          </span>
        </div>
      ) : (
        <div className="mx-3 mb-2 border-t border-border" />
      )}
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavLink key={`${item.id}:${item.href}`} item={item} expanded={expanded} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function filterGroups(
  groups: WebNavGroup[],
  allowedScopes: string[],
  predicate: (item: WebNavItem) => boolean,
  permissions?: EffectivePermissions,
): WebNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          allowedScopes.includes(item.id) &&
          predicate(item) &&
          hasRequiredPermission(item, permissions),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

export function ContextNav({ expanded, product, appId, allowedScopes, secretsEnabled }: ContextNavProps) {
  const { pathname } = useLocation();
  const { isLoading: isAuthLoading, isAuthenticated, user } = useAuthContext();
  const { data: permissions } = api.permissions.getMyPermissions({
    enabled: !isAuthLoading && isAuthenticated,
  });
  const groups = useMemo(() => {
    if (product === "organization") {
      return filterGroups(
        navGroups,
        allowedScopes,
        (item) => !SECRETS_ORG_NAV_IDS.has(item.id),
        permissions,
      );
    }

    if (appId) {
      return [
        {
          label: "Project",
          items: buildProjectNavItems(appId, allowedScopes, permissions, {
            pointInTime: planFlagEnabled(user, "point_in_time"),
            secrets: secretsEnabled,
          }),
        },
      ];
    }

    return filterGroups(
      navGroups,
      allowedScopes,
      (item) => item.id === "dashboard" || item.id === "applications",
      permissions,
    );
  }, [allowedScopes, appId, permissions, product, secretsEnabled, user]);

  const fallbackGroups = useMemo(() => {
    if (groups.length > 0) return groups;
    return [
      {
        label: "Overview",
        items: [
          { id: "dashboard", name: "Dashboard", href: "/", icon: LayoutDashboard },
          { id: "applications", name: "Projects", href: projectsPath(), icon: Database },
        ].filter((item) => allowedScopes.includes(item.id) || item.id === "dashboard"),
      },
    ];
  }, [allowedScopes, groups]);

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto overflow-x-clip px-2 py-4">
      {fallbackGroups.map((group) => (
        <NavGroup
          key={group.label}
          group={group}
          expanded={expanded}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}
