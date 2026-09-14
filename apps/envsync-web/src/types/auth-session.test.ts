import { describe, expect, test } from "bun:test";
import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";

import { normalizeAuthSession } from "./auth-session";

function baseSession(overrides: Partial<WhoAmIResponse> = {}): WhoAmIResponse {
  return {
    user: {
      id: "user_1",
      email: "dev@envsync.local",
      full_name: "Dev",
      org_id: "org_1",
      role_id: "role_1",
      profile_picture_url: null,
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    org: {
      id: "org_1",
      name: "Acme",
      logo_url: null,
      slug: "acme",
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
      is_admin: true,
      is_master: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    memberships: [],
    active_membership_user_id: "user_1",
    features: ["saml"],
    install_features: ["saml", "integrations"],
    auth_type: "jwt",
    ...overrides,
  };
}

describe("normalizeAuthSession", () => {
  test("keeps whoami entitlement fields", () => {
    const session = normalizeAuthSession(baseSession());
    expect(session.features).toEqual(["saml"]);
    expect(session.install_features).toEqual(["saml", "integrations"]);
    expect(session.auth_type).toBe("jwt");
    expect(session.memberships).toHaveLength(1);
    expect(session.memberships[0]?.is_current).toBe(true);
  });

  test("maps is_current from whoami memberships", () => {
    const session = normalizeAuthSession(baseSession({
      memberships: [
        {
          user_id: "user_1",
          org_id: "org_1",
          org_name: "Acme",
          org_slug: "acme",
          role_id: "role_1",
          role_name: "Org Admin",
          is_admin: true,
          is_master: true,
          is_active: true,
          is_current: true,
        } as WhoAmIResponse["memberships"][number] & { is_current: true },
        {
          user_id: "user_2",
          org_id: "org_2",
          org_name: "Other",
          org_slug: "other",
          role_id: "role_2",
          role_name: "Viewer",
          is_admin: false,
          is_master: false,
          is_active: true,
          is_current: false,
        } as WhoAmIResponse["memberships"][number] & { is_current: false },
      ],
    }));
    expect(session.memberships.map((membership) => membership.is_current)).toEqual([true, false]);
  });

  test("defaults missing entitlement fields", () => {
    const raw = baseSession();
    delete (raw as { features?: string[] }).features;
    delete (raw as { install_features?: string[] }).install_features;
    delete (raw as { auth_type?: string }).auth_type;

    const session = normalizeAuthSession(raw);
    expect(session.features).toEqual([]);
    expect(session.install_features).toEqual([]);
    expect(session.auth_type).toBe("jwt");
  });
});
