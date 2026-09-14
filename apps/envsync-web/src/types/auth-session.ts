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
  is_current: boolean;
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

function asMemberships(
  session: WhoAmIResponse,
  raw: unknown,
): AuthMembershipSummary[] {
  const activeUserId = session.user.id;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [{
      user_id: session.user.id,
      org_id: session.org.id,
      org_name: session.org.name,
      org_slug: session.org.slug,
      role_id: session.role.id,
      role_name: session.role.name,
      is_admin: session.role.is_admin,
      is_master: session.role.is_master,
      is_active: true,
      is_current: true,
    }];
  }
  return raw.map((item) => {
    const membership = item as AuthMembershipSummary & { is_current?: boolean };
    return {
      user_id: membership.user_id,
      org_id: membership.org_id,
      org_name: membership.org_name,
      org_slug: membership.org_slug,
      role_id: membership.role_id,
      role_name: membership.role_name,
      is_admin: Boolean(membership.is_admin),
      is_master: Boolean(membership.is_master),
      is_active: membership.is_active !== false,
      is_current: membership.is_current === true || membership.user_id === activeUserId,
    };
  });
}

export function normalizeAuthSession(session: WhoAmIResponse | AuthSession): EntitledAuthSession {
  const authSession = session as Partial<EntitledAuthSession> & WhoAmIResponse;
  const memberships = asMemberships(authSession, authSession.memberships);

  return {
    ...authSession,
    memberships,
    active_membership_user_id: authSession.active_membership_user_id ?? authSession.user.id,
    features: asStringList(authSession.features),
    install_features: asStringList(authSession.install_features),
    auth_type: asAuthType(authSession.auth_type),
  };
}
