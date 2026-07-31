import {
  Activity,
  Anchor,
  Database,
  Globe,
  Key,
  KeyRound,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import type { WebModule } from "./types";

export const coreWebModules: WebModule[] = [
  {
    name: "core",
    routes: [
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
        id: "applications",
        layout: "root",
        path: "applications",
        loadComponent: () => import("@/pages/Applications"),
      },
      {
        id: "applications-create",
        layout: "root",
        path: "applications/create",
        loadComponent: () => import("@/pages/CreateProject"),
      },
      {
        id: "applications-detail",
        layout: "root",
        path: "applications/:appId",
        loadComponent: () => import("@/pages/ProjectVariables"),
      },
      {
        id: "applications-secrets",
        layout: "root",
        path: "applications/:appId/secrets",
        loadComponent: () => import("@/pages/ProjectSecrets"),
      },
      {
        id: "applications-manage-environments",
        layout: "root",
        path: "applications/:appId/manage-environments",
        loadComponent: () => import("@/pages/ManageEnvironment"),
      },
      {
        id: "applications-access",
        layout: "root",
        path: "applications/:appId/access",
        loadComponent: () => import("@/pages/ProjectAccess"),
      },
      {
        id: "applications-pit",
        layout: "root",
        path: "applications/pit/:appId",
        loadComponent: () => import("@/pages/PointInTimeVariables"),
      },
      {
        id: "applications-pit-secrets",
        layout: "root",
        path: "applications/pit/:appId/secrets",
        loadComponent: () => import("@/pages/PointInTimeVariables"),
      },
      {
        id: "roles",
        layout: "root",
        path: "roles",
        loadComponent: () => import("@/pages/Roles"),
      },
      {
        id: "users",
        layout: "root",
        path: "users",
        loadComponent: () => import("@/pages/Users"),
      },
      {
        id: "teams",
        layout: "root",
        path: "teams",
        loadComponent: () => import("@/pages/Teams"),
      },
      {
        id: "change-requests",
        layout: "root",
        path: "change-requests",
        loadComponent: () => import("@/pages/ChangeRequests"),
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
        id: "webhooks",
        layout: "root",
        path: "webhooks",
        loadComponent: () => import("@/pages/Webhooks"),
      },
      {
        id: "gpgkeys",
        layout: "root",
        path: "gpgkeys",
        loadComponent: () => import("@/pages/GpgKeys"),
      },
      {
        id: "certificates",
        layout: "root",
        path: "certificates",
        loadComponent: () => import("@/pages/Certificates"),
      },
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
          { id: "applications", name: "Projects", href: "/applications", icon: Database },
        ],
      },
      {
        label: "Security",
        items: [
          { id: "apikeys", name: "API Keys", href: "/apikeys", icon: Key },
          { id: "gpgkeys", name: "GPG Keys", href: "/gpgkeys", icon: KeyRound },
          { id: "certificates", name: "Certificates", href: "/certificates", icon: ShieldCheck },
        ],
      },
      {
        label: "Collaboration",
        items: [
          { id: "users", name: "Users", href: "/users", icon: User },
          { id: "teams", name: "Teams", href: "/teams", icon: Users },
          { id: "roles", name: "Roles", href: "/roles", icon: ShieldAlert },
          { id: "change-requests", name: "Change Requests", href: "/change-requests", icon: ShieldCheck },
          { id: "webhooks", name: "Webhooks", href: "/webhooks", icon: Anchor },
        ],
      },
      {
        label: "Admin",
        items: [
          { id: "audit", name: "Activity", href: "/audit", icon: Activity },
          { id: "settings", name: "Account", href: "/settings", icon: Settings },
          { id: "organisation", name: "Organisation", href: "/organisation", icon: Globe },
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
