import { KeyRound, Link2, Workflow } from "lucide-react";

import type { WebModule } from "./types";

const isOrgAdmin = (user: { role: { is_admin: boolean; is_master: boolean } }) =>
  user.role.is_admin || user.role.is_master;

/**
 * Canonical enterprise dashboard modules (D10 / Phase 5b–5c).
 * Wired into the shell via Vite alias `@enterprise-modules`.
 * SSO / Key management pages land in later PRs — do not add them here.
 */
export const enterpriseWebModules: WebModule[] = [
  {
    name: "enterprise-integrations",
    requiredFeature: "integrations",
    routes: [
      {
        id: "applications-integrations",
        layout: "root",
        path: "applications/:appId/integrations",
        loadComponent: () => import("./pages/ProjectIntegrations"),
      },
      {
        id: "applications-integrations-github",
        layout: "root",
        path: "applications/:appId/integrations/github",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-gitlab",
        layout: "root",
        path: "applications/:appId/integrations/gitlab",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-vercel",
        layout: "root",
        path: "applications/:appId/integrations/vercel",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-aws-ssm",
        layout: "root",
        path: "applications/:appId/integrations/aws-ssm",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-google-secret-manager",
        layout: "root",
        path: "applications/:appId/integrations/google-secret-manager",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "organisation-integrations",
        layout: "root",
        path: "organisation/integrations",
        loadComponent: () => import("./pages/OrgIntegrations"),
      },
      {
        id: "organisation-sync",
        layout: "root",
        path: "organisation/sync",
        loadComponent: () => import("./pages/SyncOperations"),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          {
            id: "organisation-integrations",
            name: "Integrations",
            href: "/organisation/integrations",
            icon: Link2,
          },
          {
            id: "organisation-sync",
            name: "Sync ops",
            href: "/organisation/sync",
            icon: Workflow,
          },
        ],
      },
    ],
    scopeRules: {
      "applications-integrations": user =>
        (user.role.can_edit || user.role.is_admin || user.role.is_master)
        && Boolean(user.features?.includes("integrations")),
      "organisation-integrations": user =>
        isOrgAdmin(user) && Boolean(user.features?.includes("integrations")),
      "organisation-sync": user =>
        isOrgAdmin(user) && Boolean(user.features?.includes("integrations")),
    },
    settingsSections: [
      { id: "integrations", label: "Integrations" },
    ],
  },
  {
    name: "enterprise-license",
    routes: [
      {
        id: "organisation-license",
        layout: "root",
        path: "organisation/license",
        loadComponent: () => import("./pages/LicenseSettings"),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          {
            id: "organisation-license",
            name: "License",
            href: "/organisation/license",
            icon: KeyRound,
          },
        ],
      },
    ],
    scopeRules: {
      "organisation-license": isOrgAdmin,
    },
    settingsSections: [
      { id: "license", label: "License" },
    ],
  },
];
