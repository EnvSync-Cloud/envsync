import {
  Database,
  DatabaseBackup,
  GitPullRequest,
  LockKeyhole,
  PlugZap,
  Settings,
  Settings2,
  Shield,
} from "lucide-react";

import type { EffectivePermissions } from "@/api/permissions.api";
import {
  appAccessPath,
  appApprovalsPath,
  appDetailPath,
  appEnvironmentsPath,
  appIntegrationsPath,
  appPointInTimePath,
  appSecretsPath,
  appSettingsPath,
} from "@/lib/app-routes";
import type { WebNavItem } from "@/modules/types";

export function hasRequiredPermission(
  item: Pick<WebNavItem, "requiredPermission">,
  permissions?: EffectivePermissions,
) {
  if (!item.requiredPermission) return true;
  return Boolean(permissions?.[item.requiredPermission]);
}

export function buildProjectNavItems(
  appId: string,
  allowedScopes: string[],
  permissions?: EffectivePermissions,
): WebNavItem[] {
  const projectItems: WebNavItem[] = [
    { id: "project-variables", name: "Variables", href: appDetailPath(appId), icon: Database },
    { id: "project-secrets", name: "Secrets", href: appSecretsPath(appId), icon: Shield },
    { id: "project-environments", name: "Environments", href: appEnvironmentsPath(appId), icon: Settings },
    { id: "project-access", name: "Access", href: appAccessPath(appId), icon: LockKeyhole },
    { id: "project-recovery", name: "Recovery", href: appPointInTimePath(appId), icon: DatabaseBackup },
    {
      id: "project-settings",
      name: "Settings",
      href: appSettingsPath(appId),
      icon: Settings2,
      requiredPermission: "can_manage_api_keys",
    },
  ];

  if (allowedScopes.includes("change-requests")) {
    projectItems.splice(4, 0, {
      id: "project-approvals",
      name: "Approvals",
      href: appApprovalsPath(appId),
      icon: GitPullRequest,
    });
  }

  if (allowedScopes.includes("applications-integrations")) {
    projectItems.push({
      id: "applications-integrations",
      name: "Integrations",
      href: appIntegrationsPath(appId),
      icon: PlugZap,
    });
  }

  return projectItems.filter((item) => hasRequiredPermission(item, permissions));
}
