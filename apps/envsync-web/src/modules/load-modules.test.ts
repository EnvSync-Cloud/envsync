import { describe, expect, test } from "bun:test";
import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";

import { getWebFeatureMap, getWebNavGroups, getWebRoutes, isScopeAllowed } from "./load-modules";
import type { WebModule } from "./types";

const modules: WebModule[] = [
  {
    name: "enterprise-integrations",
    requiredFeature: "integrations",
    routes: [
      {
        id: "organisation-integrations",
        path: "organisation/integrations",
        loadComponent: async () => ({ default: () => null }),
      },
      {
        id: "organisation-sync",
        path: "organisation/sync",
        loadComponent: async () => ({ default: () => null }),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          { id: "organisation-integrations", name: "Integrations", href: "/organisation/integrations", icon: () => null },
          { id: "organisation-sync", name: "Sync ops", href: "/organisation/sync", icon: () => null },
        ],
      },
    ],
    scopeRules: {
      "organisation-integrations": user => user.role.is_admin || user.role.is_master,
      "organisation-sync": user => user.role.is_admin || user.role.is_master,
    },
  },
  {
    name: "enterprise-license",
    routes: [
      {
        id: "organisation-license",
        path: "organisation/license",
        loadComponent: async () => ({ default: () => null }),
      },
    ],
    navGroups: [
      {
        label: "Enterprise",
        items: [
          { id: "organisation-license", name: "License", href: "/organisation/license", icon: () => null },
        ],
      },
    ],
    scopeRules: {
      "organisation-license": user => user.role.is_admin || user.role.is_master,
    },
  },
];

function user(features: string[], role: { is_admin?: boolean; is_master?: boolean } = { is_admin: true }): WhoAmIResponse {
  return {
    user: {
      id: "user_1",
      email: "admin@envsync.local",
      full_name: "Admin",
      org_id: "org_1",
      role_id: "role_1",
      profile_picture_url: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    org: {
      id: "org_1",
      name: "Restricted",
      logo_url: null,
      slug: "ui-restricted",
      size: null,
      website: null,
      metadata: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    role: {
      id: "role_1",
      name: "Org Admin",
      org_id: "org_1",
      can_edit: true,
      can_view: true,
      have_api_access: true,
      have_billing_options: true,
      have_webhook_access: true,
      have_gpg_access: true,
      have_cert_access: true,
      have_audit_access: true,
      is_admin: role.is_admin ?? false,
      is_master: role.is_master ?? false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    memberships: [],
    active_membership_user_id: "user_1",
    features,
    install_features: ["saml", "integrations"],
    auth_type: "jwt",
  };
}

describe("entitlement-aware module shell", () => {
  test("inherits requiredFeature onto routes and merges Enterprise nav", () => {
    const routes = getWebRoutes(modules);
    expect(routes.find(route => route.id === "organisation-integrations")?.requiredFeature).toBe("integrations");
    expect(routes.find(route => route.id === "organisation-license")?.requiredFeature).toBeUndefined();

    const nav = getWebNavGroups(modules);
    expect(nav).toHaveLength(1);
    expect(nav[0]?.items.map(item => item.id)).toEqual([
      "organisation-integrations",
      "organisation-sync",
      "organisation-license",
    ]);
  });

  test("restricted org hides Integrations but keeps License", () => {
    const featureMap = getWebFeatureMap(modules);
    const scopeRules = {
      "organisation-integrations": (session: WhoAmIResponse) => session.role.is_admin || session.role.is_master,
      "organisation-sync": (session: WhoAmIResponse) => session.role.is_admin || session.role.is_master,
      "organisation-license": (session: WhoAmIResponse) => session.role.is_admin || session.role.is_master,
    };
    const restricted = user(["saml"]);

    expect(isScopeAllowed(restricted, "organisation-integrations", { scopeRules, featureMap })).toBe(false);
    expect(isScopeAllowed(restricted, "organisation-sync", { scopeRules, featureMap })).toBe(false);
    expect(isScopeAllowed(restricted, "organisation-license", { scopeRules, featureMap })).toBe(true);
    expect(isScopeAllowed(user(["integrations"]), "organisation-integrations", { scopeRules, featureMap })).toBe(true);
    expect(isScopeAllowed(user(["integrations"], { is_admin: false }), "organisation-license", { scopeRules, featureMap })).toBe(false);
  });
});
