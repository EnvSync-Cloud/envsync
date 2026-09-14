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

import { LEGACY_REDIRECTS } from "@/lib/app-routes";

import type { WebModule, WebRouteDefinition } from "./types";

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
        id: "org-users",
        layout: "root",
        path: "org/users",
        loadComponent: () => import("@/pages/Users"),
      },
      {
        id: "org-teams",
        layout: "root",
        path: "org/teams",
        loadComponent: () => import("@/pages/Teams"),
      },
      {
        id: "org-roles",
        layout: "root",
        path: "org/roles",
        loadComponent: () => import("@/pages/Roles"),
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
        id: "organisation",
        layout: "root",
        path: "organisation",
        loadComponent: () => import("@/pages/OrgSettings"),
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
          { id: "applications", name: "Projects", href: "/projects", icon: Database },
        ],
      },
      {
        label: "Security",
        items: [
          { id: "apikeys", name: "API Keys", href: "/apikeys", icon: Key },
          { id: "gpgkeys", name: "GPG Keys", href: "/gpgkeys", icon: KeyRound },
          { id: "certificates", name: "Certificates", href: "/org/certificates", icon: ShieldCheck },
        ],
      },
      {
        label: "Collaboration",
        items: [
          { id: "access", name: "Access", href: "/org/access", icon: Users },
          { id: "change-requests", name: "Change Requests", href: "/org/change-requests", icon: ShieldCheck },
          { id: "webhooks", name: "Webhooks", href: "/org/webhooks", icon: Anchor },
        ],
      },
      {
        label: "Admin",
        items: [
          { id: "audit", name: "Activity", href: "/audit", icon: Activity },
          { id: "settings", name: "Account", href: "/settings", icon: Settings },
          { id: "organisation", name: "Organization", href: "/organisation", icon: Globe },
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
      "change-requests": user => user.role.can_edit || user.role.is_admin || user.role.is_master,
      organisation: user => user.role.is_admin || user.role.is_master,
      audit: user => user.role.is_admin || user.role.is_master,
      settings: () => true,
      webhooks: () => true,
      gpgkeys: () => true,
      certificates: () => true,
    },
    settingsSections: [],
  },
];
