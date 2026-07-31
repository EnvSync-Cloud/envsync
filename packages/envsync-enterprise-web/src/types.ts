import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

/** Compatible with apps/envsync-web WebModule contract. */
export interface WebNavItem {
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface WebNavGroup {
  label: string;
  items: WebNavItem[];
}

export interface SettingsSection {
  id: string;
  label: string;
}

export interface WebRouteDefinition {
  id: string;
  layout?: "root" | "standalone";
  path?: string;
  index?: boolean;
  loadComponent: () => Promise<{ default: ComponentType }>;
}

export type ScopeRule = (user: WhoAmIResponse) => boolean;

export interface WebModule {
  name: string;
  routes: WebRouteDefinition[];
  navGroups: WebNavGroup[];
  scopeRules?: Record<string, ScopeRule>;
  settingsSections?: SettingsSection[];
}
