import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest, isReloginError, redirectToLogin, sdk } from "@/api";
import { identifyUser } from "@/telemetry";
import { normalizeAuthSession, type AuthSession } from "@/types/auth-session";

export const useAuth = () => {
  const [user, setUser] = useState<AuthSession | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSwitchingOrg, setIsSwitchingOrg] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const queryClient = useQueryClient();

  const syncIdentity = useCallback((userData: AuthSession) => {
    identifyUser(userData.user.id, {
      email: userData.user.email,
      name: userData.user.full_name,
      org: userData.org.name || "",
      orgId: userData.org.id,
      roleName: userData.role.name,
    });
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const userData = normalizeAuthSession(await sdk.authentication.whoami());
      setUser(userData);
      setIsAuthenticated(true);
      syncIdentity(userData);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setIsAuthenticated(false);
      setUser(undefined);
      if (isReloginError(error)) {
        setAuthError(null);
        await redirectToLogin();
        return;
      }
      setAuthError("Could not load your session. Check the API is running and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [syncIdentity]);

  useEffect(() => {
    setAuthError(null);
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        void fetchUser();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchUser, isAuthenticated]);

  const switchOrg = useCallback(async (orgId: string) => {
    if (!user || user.org.id === orgId) return;

    setIsSwitchingOrg(true);
    setAuthError(null);

    try {
      const switchedSession = normalizeAuthSession(
        await apiRequest<AuthSession>("/api/auth/switch-org", {
          method: "POST",
          body: JSON.stringify({ org_id: orgId }),
        }),
      );
      setUser(switchedSession);
      setIsAuthenticated(true);
      syncIdentity(switchedSession);
      queryClient.clear();
      window.location.assign("/");
    } catch (error) {
      console.error("Failed to switch organization:", error);
      if (isReloginError(error)) {
        await redirectToLogin();
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to switch organization.";
      setAuthError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsSwitchingOrg(false);
    }
  }, [queryClient, syncIdentity, user]);

  const createWorkspace = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Workspace name is required.");
    }

    setIsCreatingWorkspace(true);
    setAuthError(null);

    try {
      const createdSession = normalizeAuthSession(
        await apiRequest<AuthSession>("/api/auth/create-workspace", {
          method: "POST",
          body: JSON.stringify({ name: trimmedName }),
        }),
      );
      setUser(createdSession);
      setIsAuthenticated(true);
      syncIdentity(createdSession);
      queryClient.clear();
      window.location.assign("/");
    } catch (error) {
      console.error("Failed to create workspace:", error);
      if (isReloginError(error)) {
        await redirectToLogin();
        return;
      }
      const message = error instanceof Error ? error.message : "Failed to create workspace.";
      setAuthError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsCreatingWorkspace(false);
    }
  }, [queryClient, syncIdentity]);

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated,
    api: sdk,
    token: null,
    authError,
    switchOrg,
    isSwitchingOrg,
    createWorkspace,
    isCreatingWorkspace,
  };
};
