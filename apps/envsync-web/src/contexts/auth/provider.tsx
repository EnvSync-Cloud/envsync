import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthContext } from ".";
import { getRegisteredScopeIds, getWebFeatureMap, getWebScopeRuleMap, isScopeAllowed } from "@/modules/load-modules";

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
    createOrganization,
    isCreatingOrganization,
  } = useAuth();
  const registeredScopes = useMemo(() => getRegisteredScopeIds(), []);
  const scopeRules = useMemo(() => getWebScopeRuleMap(), []);
  const featureMap = useMemo(() => getWebFeatureMap(), []);

  const contextValue = useMemo(() => {
    const memberships = user?.memberships ?? [];
    const allowedScopes = registeredScopes.filter((scope) =>
      isScopeAllowed(user, scope, { scopeRules, featureMap }),
    );

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
      createOrganization,
      isCreatingOrganization,
    };
  }, [
    user,
    isLoading,
    isAuthenticated,
    token,
    authError,
    registeredScopes,
    scopeRules,
    featureMap,
    switchOrg,
    isSwitchingOrg,
    createOrganization,
    isCreatingOrganization,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
