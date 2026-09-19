import {
  Activity,
  Anchor,
  Database,
  Globe,
  Key,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  apiKeysPath,
  LEGACY_REDIRECTS,
  orgAccessPath,
  orgCertificatesPath,
  orgChangeRequestsPath,
  orgSettingsPath,
  orgWebhooksPath,
  projectsPath,
} from "@/lib/app-routes";

import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";

import type { WebModule, WebRouteDefinition } from "./types";

function planAllows(user: WhoAmIResponse, flag: "change_requests" | "point_in_time" | "certificates") {
  const limits = (user as { plan_limits?: Record<string, boolean> }).plan_limits;
  if (!limits) return true;
  return limits[flag] !== false;
}

const legacyRedirectRoutes: WebRouteDefinition[] = LEGACY_REDIRECTS.map((redirect) => ({
  id: redirect.id,
  layout: "root",
  path: redirect.path,
  redirectTo: redirect.to,
}));

export const coreWebModules: WebModule[] = [
  {
    name: "core",
    routes: [
      {
        id: "login",
        layout: "standalone",
        path: "/login",
        loadComponent: () => import("@/pages/Login"),
      },
      {
        id: "auth-callback",
        layout: "standalone",
        path: "/auth/callback",
        loadComponent: () => import("@/pages/Callback"),
      },
      {
        // Public user-invite accept (self-host emails point here; Hosted landing may share path)
        id: "accept-user-invite",
        layout: "standalone",
        path: "/onboarding/accept-user-invite/:invite_code",
        loadComponent: () => import("@/pages/AcceptUserInvite"),
      },
      {
        id: "dashboard-index",
        layout: "root",
        index: true,
        loadComponent: () => import("@/pages/Dashboard"),
      },
      {
        id: "dashboard",
        layout: "root",
        path: "dashboard",
        loadComponent: () => import("@/pages/Dashboard"),
      },
      {
        id: "projects",
        layout: "root",
        path: "projects",
        loadComponent: () => import("@/pages/Applications"),
      },
      {
        id: "projects-create",
        layout: "root",
        path: "projects/create",
        loadComponent: () => import("@/pages/CreateProject"),
      },
      {
        id: "projects-detail",
        layout: "root",
        path: "projects/:appId",
        loadComponent: () => import("@/pages/ProjectVariables"),
      },
      {
        id: "projects-secrets",
        layout: "root",
        path: "projects/:appId/secrets",
        loadComponent: () => import("@/pages/ProjectSecrets"),
      },
      {
        id: "projects-manage-environments",
        layout: "root",
        path: "projects/:appId/manage-environments",
        loadComponent: () => import("@/pages/ManageEnvironment"),
      },
      {
        id: "projects-environments",
        layout: "root",
        path: "projects/:appId/environments",
        loadComponent: () => import("@/pages/ManageEnvironment"),
      },
      {
        id: "projects-access",
        layout: "root",
        path: "projects/:appId/access",
        loadComponent: () => import("@/pages/ProjectAccess"),
      },
      {
        id: "projects-approvals",
        layout: "root",
        path: "projects/:appId/approvals",
        loadComponent: () => import("@/pages/ChangeRequests"),
      },
      {
        id: "projects-change-requests",
        layout: "root",
        path: "projects/:appId/change-requests",
        redirectTo: "/projects/:appId/approvals",
      },
      {
        id: "projects-settings",
        layout: "root",
        path: "projects/:appId/settings",
        redirectTo: "/projects/:appId/settings/service-tokens",
      },
      {
        id: "projects-service-tokens",
        layout: "root",
        path: "projects/:appId/settings/service-tokens",
        loadComponent: () => import("@/pages/ServiceTokens"),
      },
      {
        id: "projects-pit",
        layout: "root",
        path: "projects/:appId/pit",
        loadComponent: () => import("@/pages/PointInTimeVariables"),
      },
      {
        id: "projects-pit-secrets",
        layout: "root",
        path: "projects/:appId/pit/secrets",
        loadComponent: () => import("@/pages/PointInTimeVariables"),
      },
      {
        id: "org-access",
        layout: "root",
        path: "org/access",
        loadComponent: () => import("@/pages/OrgAccess"),
      },
      {
        id: "org-access-tab",
        layout: "root",
        path: "org/access/:tab",
        loadComponent: () => import("@/pages/OrgAccess"),
      },

      {
        id: "org-certificates",
        layout: "root",
        path: "org/certificates",
        loadComponent: () => import("@/pages/Certificates"),
      },
      {
        id: "org-webhooks",
        layout: "root",
        path: "org/webhooks",
        loadComponent: () => import("@/pages/Webhooks"),
      },
      {
        id: "org-change-requests",
        layout: "root",
        path: "org/change-requests",
        loadComponent: () => import("@/pages/ChangeRequests"),
      },
      {
        id: "org-index",
        layout: "root",
        path: "org",
        loadComponent: () => import("@/pages/OrgSettings"),
      },
      {
        id: "settings",
        layout: "root",
        path: "settings",
        loadComponent: () => import("@/pages/UserSettings"),
      },
      {
        id: "audit",
        layout: "root",
        path: "audit",
        loadComponent: () => import("@/pages/AuditLogs"),
      },
      {
        id: "apikeys",
        layout: "root",
        path: "apikeys",
        loadComponent: () => import("@/pages/ApiKeys"),
      },
      {
        id: "gpgkeys",
        layout: "root",
        path: "gpgkeys",
        loadComponent: () => import("@/pages/GpgKeys"),
      },
      ...legacyRedirectRoutes,
      {
        id: "not-found",
        layout: "standalone",
        path: "*",
        loadComponent: () => import("@/pages/NotFound"),
      },
    ],
    navGroups: [
      {
        label: "Overview",
        items: [
          { id: "dashboard", name: "Dashboard", href: "/", icon: LayoutDashboard },
        ],
      },
      {
        label: "Projects",
        items: [
          { id: "applications", name: "Projects", href: projectsPath(), icon: Database },
        ],
      },
      {
        label: "Certificates",
        items: [
          { id: "certificates", name: "Certificates", href: orgCertificatesPath(), icon: ShieldCheck },
          { id: "gpgkeys", name: "GPG Keys", href: "/gpgkeys", icon: KeyRound },
        ],
      },
      {
        label: "Security",
        items: [
          { id: "apikeys", name: "API Keys", href: apiKeysPath(), icon: Key },
        ],
      },
      {
        label: "Collaboration",
        items: [
          { id: "access", name: "Access", href: orgAccessPath(), icon: Users },
          { id: "change-requests", name: "Change Requests", href: orgChangeRequestsPath(), icon: ShieldCheck },
          { id: "webhooks", name: "Webhooks", href: orgWebhooksPath(), icon: Anchor },
        ],
      },
      {
        label: "Admin",
        items: [
          { id: "audit", name: "Activity", href: "/audit", icon: Activity },
          { id: "settings", name: "Account", href: "/settings", icon: Settings },
          { id: "organisation", name: "Organization", href: orgSettingsPath(), icon: Globe },
        ],
      },
    ],
    scopeRules: {
      dashboard: () => true,
      apikeys: user => user.role.have_api_access || user.role.is_admin || user.role.is_master,
      applications: user => user.role.can_edit || user.role.is_admin || user.role.is_master || user.role.can_view,
      users: () => true,
      teams: () => true,
      roles: user => user.role.is_admin || user.role.is_master,
      access: () => true,
      "change-requests": user =>
        (user.role.can_edit || user.role.is_admin || user.role.is_master)
        && planAllows(user, "change_requests"),
      organisation: user => user.role.is_admin || user.role.is_master,
      audit: user => user.role.is_admin || user.role.is_master,
      settings: () => true,
      webhooks: () => true,
      gpgkeys: user => planAllows(user, "certificates"),
      certificates: user => planAllows(user, "certificates"),
    },
    settingsSections: [],
  },
];
