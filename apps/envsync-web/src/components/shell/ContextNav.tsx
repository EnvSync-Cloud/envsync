import { Link, useLocation } from "react-router-dom";
import {
  Database,
  DatabaseBackup,
  LayoutDashboard,
  LockKeyhole,
  PlugZap,
  Settings,
  Shield,
} from "lucide-react";
import { useMemo } from "react";

import { navGroups } from "@/constants";
import {
  appAccessPath,
  appDetailPath,
  appIntegrationsPath,
  appManageEnvironmentsPath,
  appPointInTimePath,
  appSecretsPath,
} from "@/lib/app-routes";
import type { ProductId } from "@/lib/shell-context";
import { cn } from "@/lib/utils";
import type { WebNavGroup, WebNavItem } from "@/modules/types";

const CERTIFICATE_NAV_IDS = new Set(["certificates"]);
const SECRETS_ORG_NAV_IDS = new Set(["dashboard", "applications"]);

interface ContextNavProps {
  expanded: boolean;
  product: ProductId;
  appId: string | null;
  allowedScopes: string[];
}

function isItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/dashboard";
  if (href === "/projects") {
    return pathname === "/projects" || pathname.startsWith("/projects/create");
  }
  if (pathname === href) return true;
  if (/^\/projects\/[^/]+$/.test(href)) return false;
  return pathname.startsWith(`${href}/`);
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
          "relative flex w-full items-center rounded-2xl text-left text-sm font-medium transition-all duration-200",
          expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
          isActive
            ? "border border-primary/20 bg-primary/12 text-foreground"
            : "border border-transparent text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
        )}
        title={!expanded ? item.name : undefined}
      >
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            isActive
              ? "bg-primary/18 text-primary"
              : "bg-secondary text-muted-foreground group-hover:text-foreground",
          )}
        >
          <Icon className="size-[18px]" />
        </span>
        {expanded && (
          <span className="block min-w-0 truncate">{item.name}</span>
        )}
      </Link>
      {!expanded && (
        <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-primary/20 bg-popover px-2.5 py-1.5 text-xs text-foreground opacity-0 invisible backdrop-blur-sm transition-all duration-150 group-hover:visible group-hover:opacity-100">
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
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-tertiary">
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
): WebNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedScopes.includes(item.id) && predicate(item)),
    }))
    .filter((group) => group.items.length > 0);
}

export function ContextNav({ expanded, product, appId, allowedScopes }: ContextNavProps) {
  const { pathname } = useLocation();

  const groups = useMemo(() => {
    if (product === "certificates") {
      return filterGroups(navGroups, allowedScopes, (item) => CERTIFICATE_NAV_IDS.has(item.id));
    }

    if (product === "organization") {
      return filterGroups(
        navGroups,
        allowedScopes,
        (item) => !SECRETS_ORG_NAV_IDS.has(item.id) && !CERTIFICATE_NAV_IDS.has(item.id),
      );
    }

    if (appId) {
      const projectItems: WebNavItem[] = [
        { id: "project-variables", name: "Variables", href: appDetailPath(appId), icon: Database },
        { id: "project-secrets", name: "Secrets", href: appSecretsPath(appId), icon: Shield },
        { id: "project-environments", name: "Environments", href: appManageEnvironmentsPath(appId), icon: Settings },
        { id: "project-access", name: "Access", href: appAccessPath(appId), icon: LockKeyhole },
        { id: "project-recovery", name: "Recovery", href: appPointInTimePath(appId), icon: DatabaseBackup },
      ];

      if (allowedScopes.includes("applications-integrations")) {
        projectItems.push({
          id: "applications-integrations",
          name: "Integrations",
          href: appIntegrationsPath(appId),
          icon: PlugZap,
        });
      }

      return [
        {
          label: "Project",
          items: projectItems,
        },
      ];
    }

    return filterGroups(
      navGroups,
      allowedScopes,
      (item) => item.id === "dashboard" || item.id === "applications",
    );
  }, [allowedScopes, appId, product]);

  const fallbackGroups = useMemo(() => {
    if (groups.length > 0) return groups;
    return [
      {
        label: "Overview",
        items: [
          { id: "dashboard", name: "Dashboard", href: "/", icon: LayoutDashboard },
          { id: "applications", name: "Projects", href: "/projects", icon: Database },
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
