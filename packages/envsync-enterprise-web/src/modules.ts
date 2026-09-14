import { Fingerprint, KeyRound, Link2, LockKeyhole, Workflow } from "lucide-react";

import type { WebModule } from "./types";

const isOrgAdmin = (user: { role: { is_admin: boolean; is_master: boolean } }) =>
  user.role.is_admin || user.role.is_master;

/**
 * Canonical enterprise dashboard modules (D10 / Phase 5b–5c).
 * Wired into the shell via Vite alias `@enterprise-modules`.
 */
export const enterpriseWebModules: WebModule[] = [
  {
    name: "enterprise-integrations",
    requiredFeature: "integrations",
    routes: [
      {
        id: "applications-integrations",
        layout: "root",
        path: "projects/:appId/integrations",
        loadComponent: () => import("./pages/ProjectIntegrations"),
      },
      {
        id: "applications-integrations-github",
        layout: "root",
        path: "projects/:appId/integrations/github",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-gitlab",
        layout: "root",
        path: "projects/:appId/integrations/gitlab",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-vercel",
        layout: "root",
        path: "projects/:appId/integrations/vercel",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-aws-ssm",
        layout: "root",
        path: "projects/:appId/integrations/aws-ssm",
        loadComponent: () => import("./pages/ProjectIntegrationProvider"),
      },
      {
        id: "applications-integrations-google-secret-manager",
        layout: "root",
        path: "projects/:appId/integrations/google-secret-manager",
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
  {
    name: "enterprise-sso",
    requiredFeature: "saml",
    routes: [
      {
        id: "organisation-sso",
        layout: "root",
        path: "organisation/sso",
        loadComponent: () => import("./pages/OrgSso"),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          {
            id: "organisation-sso",
            name: "SSO",
            href: "/organisation/sso",
            icon: Fingerprint,
          },
        ],
      },
    ],
    scopeRules: {
      "organisation-sso": user =>
        isOrgAdmin(user) && Boolean(user.features?.includes("saml")),
    },
    settingsSections: [
      { id: "sso", label: "SSO" },
    ],
  },
  {
    name: "enterprise-kms",
    requiredFeature: "kms",
    routes: [
      {
        id: "organisation-keys",
        layout: "root",
        path: "organisation/keys",
        loadComponent: () => import("./pages/KeyManagement"),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          {
            id: "organisation-keys",
            name: "Key management",
            href: "/organisation/keys",
            icon: LockKeyhole,
          },
        ],
      },
    ],
    scopeRules: {
      "organisation-keys": user =>
        isOrgAdmin(user) && Boolean(user.features?.includes("kms")),
    },
    settingsSections: [
      { id: "keys", label: "Key management" },
    ],
  },
];
