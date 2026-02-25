import { useEffect, useState } from "react";
import { type WhoAmIResponse } from "@envsync-cloud/envsync-ts-sdk";
import { getSDK } from "@/api";
import { identifyUser } from "@/telemetry";

export const useAuth = () => {
  const [user, setUser] = useState<WhoAmIResponse | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const accessToken = typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null;
  const api = getSDK(accessToken ?? undefined);

  useEffect(() => {
    const isCallbackPage =
      typeof window !== "undefined" &&
      window.location.pathname === "/auth/callback" &&
      new URLSearchParams(window.location.hash.slice(1)).get("access_token");
    if (isCallbackPage) {
      setIsLoading(false);
      return;
    }

    if (!accessToken) {
      setIsLoading(false);
      setAuthError(null);
      api.access
        .createWebLogin()
        .then((response) => {
          if (response?.loginUrl) {
            window.location.href = response.loginUrl;
          }
        })
        .catch((error) => {
          console.error("Failed to create web login:", error);
          setAuthError("Could not start sign-in. Check the API is running and try again.");
        });
      return;
    }

    setIsAuthenticated(true);
    setAuthError(null);
    const fetchUser = async () => {
      try {
        const userData = await api.authentication.whoami();
        setUser(userData);
        identifyUser(userData.user.id, {
          email: userData.user.email,
          org: userData.org.name || "",
        });
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setAuthError("Session may have expired. Sign in again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [accessToken]);

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated,
    api,
    token: accessToken,
    authError,
  };
};
