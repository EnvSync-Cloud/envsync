import type { WebModule } from "./types";

/**
 * Canonical enterprise dashboard modules (D10 / Phase 5b).
 * Wired into the shell via Vite alias `@enterprise-modules`.
 */
export const enterpriseWebModules: WebModule[] = [
  {
    name: "enterprise-integrations",
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
    ],
    navGroups: [],
    scopeRules: {
      "applications-integrations": user => user.role.can_edit || user.role.is_admin || user.role.is_master,
      "organisation-integrations": user => user.role.is_admin || user.role.is_master,
    },
    settingsSections: [],
  },
];
