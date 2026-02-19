import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthContext } from ".";
import { SCOPES } from "@/constants";

export const AuthContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAuthenticated, isLoading, user, token, authError } = useAuth();
  const contextValue = useMemo(() => {
    const allowedScopes = SCOPES.filter((scope) => {
      if (!user) return false;
      const { have_api_access, is_admin, is_master, can_edit, can_view } =
        user.role;

      switch (scope) {
        case "dashboard":
          return true;

        case "apikeys":
          return have_api_access || is_admin || is_master;

        case "applications":
          return can_edit || is_admin || is_master || can_view;

        case "users":
          return true;

        case "roles":
        case "organisation":
        case "audit":
          return is_admin || is_master;

        case "settings":
          return true;

        default:
          return true;
      }
    });

    return {
      token,
      user,
      isLoading,
      isAuthenticated,
      allowedScopes,
      authError: authError ?? null,
    };
  }, [user, isLoading, isAuthenticated, token, authError]);

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
