import type { WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";

export interface AuthMembershipSummary {
  user_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role_id: string;
  role_name: string;
  is_admin: boolean;
  is_master: boolean;
  is_active: boolean;
}

export type AuthSessionAuthType = "jwt" | "saml" | "oidc" | "api_key";

export type AuthSession = WhoAmIResponse & {
  memberships: AuthMembershipSummary[];
  active_membership_user_id: string;
};

/** Local fallback until every caller uses the generated whoami fields. */
export type EntitledAuthSession = AuthSession & {
  features: string[];
  install_features: string[];
  auth_type: AuthSessionAuthType;
};

const AUTH_TYPES = new Set<AuthSessionAuthType>(["jwt", "saml", "oidc", "api_key"]);

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asAuthType(value: unknown): AuthSessionAuthType {
  return typeof value === "string" && AUTH_TYPES.has(value as AuthSessionAuthType)
    ? (value as AuthSessionAuthType)
    : "jwt";
}

export function normalizeAuthSession(session: WhoAmIResponse | AuthSession): EntitledAuthSession {
  const authSession = session as Partial<EntitledAuthSession> & WhoAmIResponse;
  const memberships = Array.isArray(authSession.memberships) && authSession.memberships.length > 0
    ? authSession.memberships
    : [{
        user_id: authSession.user.id,
        org_id: authSession.org.id,
        org_name: authSession.org.name,
        org_slug: authSession.org.slug,
        role_id: authSession.role.id,
        role_name: authSession.role.name,
        is_admin: authSession.role.is_admin,
        is_master: authSession.role.is_master,
        is_active: true,
      }];

  return {
    ...authSession,
    memberships,
    active_membership_user_id: authSession.active_membership_user_id ?? authSession.user.id,
    features: asStringList(authSession.features),
    install_features: asStringList(authSession.install_features),
    auth_type: asAuthType(authSession.auth_type),
  };
}
