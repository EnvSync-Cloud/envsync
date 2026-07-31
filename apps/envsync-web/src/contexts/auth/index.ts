import { createContext, useContext } from "react";
import type { AuthMembershipSummary, AuthSession } from "@/types/auth-session";

export interface IAuthContext {
  user: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  allowedScopes: string[];
  authError: string | null;
  memberships: AuthMembershipSummary[];
  activeMembershipUserId: string | null;
  isSwitchingOrg: boolean;
  isCreatingOrganization: boolean;
  switchOrg: (orgId: string) => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
}

const FALLBACK_AUTH_CONTEXT: IAuthContext = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  token: null,
  allowedScopes: [],
  authError: "Auth context unavailable",
  memberships: [],
  activeMembershipUserId: null,
  isSwitchingOrg: false,
  isCreatingOrganization: false,
  switchOrg: async () => undefined,
  createOrganization: async () => undefined,
};

let hasWarnedMissingProvider = false;

export const AuthContext = createContext<IAuthContext>(FALLBACK_AUTH_CONTEXT);
export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (context === FALLBACK_AUTH_CONTEXT && !hasWarnedMissingProvider) {
    hasWarnedMissingProvider = true;
    console.warn("useAuthContext was called without an AuthContextProvider");
  }

  return context;
};

export * from "./provider";
