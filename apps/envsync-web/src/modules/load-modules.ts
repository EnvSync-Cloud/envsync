import { coreWebModules } from "./core-modules";
import { enterpriseWebModules } from "@enterprise-modules";
import { externalWebModules } from "./external-modules";
import type { ProjectSettingsTab, ScopeRule, SettingsSection, WebModule, WebNavGroup, WebNavItem, WebRouteDefinition } from "./types";
import { isEnterpriseDashboard } from "@/utils/runtime-config";
import { hasEntitledFeature } from "@/lib/entitlements";

const webModules = [
  ...coreWebModules,
  ...(isEnterpriseDashboard ? enterpriseWebModules : []),
  ...externalWebModules,
];

function dedupeByKey<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function loadWebModules(): WebModule[] {
  return [...webModules];
}

export function getWebRoutes(modules: WebModule[] = loadWebModules()): WebRouteDefinition[] {
  return modules.flatMap((module) =>
    module.routes.map((route) => ({
      ...route,
      requiredFeature: route.requiredFeature ?? module.requiredFeature,
    })),
  );
}

export function getWebNavGroups(modules: WebModule[] = loadWebModules()): WebNavGroup[] {
  const groups: WebNavGroup[] = [];
  const byLabel = new Map<string, WebNavGroup>();

  for (const module of modules) {
    for (const group of module.navGroups) {
      const existing = byLabel.get(group.label);
      if (existing) {
        existing.items.push(...group.items);
        continue;
      }
      const merged = { label: group.label, items: [...group.items] };
      byLabel.set(group.label, merged);
      groups.push(merged);
    }
  }

  return groups;
}

export function getWebNavItems(modules: WebModule[] = loadWebModules()): WebNavItem[] {
  return dedupeByKey(
    getWebNavGroups(modules).flatMap((group) => group.items),
    (item) => `${item.id}:${item.href}`
  );
}

export function getWebScopeRuleMap(modules: WebModule[] = loadWebModules()): Record<string, ScopeRule> {
  return modules.reduce<Record<string, ScopeRule>>((rules, module) => {
    Object.assign(rules, module.scopeRules ?? {});
    return rules;
  }, {});
}

export function getRegisteredScopeIds(modules: WebModule[] = loadWebModules()): string[] {
  const scopeIds = [
    ...Object.keys(getWebScopeRuleMap(modules)),
    ...getWebNavItems(modules).map((item) => item.id),
  ];

  return [...new Set(scopeIds)];
}

export function getSettingsSections(modules: WebModule[] = loadWebModules()): SettingsSection[] {
  return dedupeByKey(
    modules.flatMap((module) => module.settingsSections ?? []),
    (section) => section.id
  );
}

export function getProjectSettingsTabs(
  appId: string,
  allowedScopes: readonly string[],
  modules: WebModule[] = loadWebModules(),
): Array<{ id: string; label: string; href: string }> {
  return dedupeByKey(
    modules
      .flatMap((module) => module.projectSettingsTabs ?? [])
      .filter((tab: ProjectSettingsTab) => allowedScopes.includes(tab.scopeId))
      .map((tab) => ({ id: tab.id, label: tab.label, href: tab.href(appId) })),
    (tab) => tab.id,
  );
}

export function getWebFeatureMap(modules: WebModule[] = loadWebModules()): Record<string, string | undefined> {
  const featureMap: Record<string, string | undefined> = {};

  for (const module of modules) {
    for (const route of module.routes) {
      featureMap[route.id] = route.requiredFeature ?? module.requiredFeature;
    }
    for (const group of module.navGroups) {
      for (const item of group.items) {
        if (featureMap[item.id] === undefined) {
          featureMap[item.id] = module.requiredFeature;
        }
      }
    }
  }

  return featureMap;
}

export function isScopeAllowed(
  user: { features?: readonly string[]; role?: unknown } | null | undefined,
  scope: string,
  options: {
    scopeRules?: Record<string, ScopeRule>;
    featureMap?: Record<string, string | undefined>;
  } = {},
): boolean {
  if (!user) return false;
  if (!hasEntitledFeature(user, options.featureMap?.[scope])) return false;
  return options.scopeRules?.[scope]?.(user as Parameters<ScopeRule>[0]) ?? true;
}
