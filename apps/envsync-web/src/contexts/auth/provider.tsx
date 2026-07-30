import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthContext } from ".";
import { getRegisteredScopeIds, getWebScopeRuleMap } from "@/modules/load-modules";

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const {
    isAuthenticated,
    isLoading,
    user,
    token,
    authError,
    switchOrg,
    isSwitchingOrg,
    createWorkspace,
    isCreatingWorkspace,
  } = useAuth();
  const registeredScopes = useMemo(() => getRegisteredScopeIds(), []);
  const scopeRules = useMemo(() => getWebScopeRuleMap(), []);

  const contextValue = useMemo(() => {
    const memberships = user?.memberships ?? [];
    const allowedScopes = registeredScopes.filter((scope) => {
      if (!user) return false;

      return scopeRules[scope]?.(user) ?? true;
    });

    return {
      token,
      user,
      isLoading,
      isAuthenticated,
      allowedScopes,
      authError: authError ?? null,
      memberships,
      activeMembershipUserId: user?.active_membership_user_id ?? null,
      switchOrg,
      isSwitchingOrg,
      createWorkspace,
      isCreatingWorkspace,
    };
  }, [
    user,
    isLoading,
    isAuthenticated,
    token,
    authError,
    registeredScopes,
    scopeRules,
    switchOrg,
    isSwitchingOrg,
    createWorkspace,
    isCreatingWorkspace,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
