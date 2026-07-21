import { useQuery } from "@tanstack/react-query";
import { api as Api, sdk } from "@/api";
import { useAuthContext } from "@/contexts/auth";

export function useDashboard() {
  const { isLoading: isAuthLoading, isAuthenticated } = useAuthContext();
  const authEnabled = !isAuthLoading && isAuthenticated;

  const {
    data: apps = [],
    isLoading: appsLoading,
    error: appsError,
  } = Api.applications.allApplications({ enabled: authEnabled });

  const {
    data: usersData,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ["dashboard-users"],
    queryFn: async () => {
      const users = await sdk.users.getUsers();
      return users;
    },
    enabled: authEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const {
    data: apiKeysData,
    isLoading: apiKeysLoading,
  } = useQuery({
    queryKey: ["dashboard-api-keys"],
    queryFn: async () => {
      const keys = await sdk.apiKeys.getAllApiKeys();
      return keys;
    },
    enabled: authEnabled,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const {
    data: auditLogs = [],
    isLoading: auditLoading,
  } = useQuery({
    queryKey: ["dashboard-audit"],
    queryFn: async () => {
      const logs = await sdk.auditLogs.getAuditLogs("1", "20");
      return logs.auditLogs ?? [];
    },
    enabled: authEnabled,
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  const stats = {
    projectsCount: apps.length,
    variablesCount: apps.reduce(
      (sum, app) => sum + (app.env_count ?? 0) + (app.secret_count ?? 0),
      0
    ),
    teamMembersCount: usersData?.length ?? 0,
    apiKeysCount: apiKeysData?.length ?? 0,
  };

  const isLoading = appsLoading || usersLoading || apiKeysLoading;
  const error = appsError ?? null;

  const recentProjects = [...apps]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 5);

  return {
    stats,
    recentProjects,
    auditLogs,
    isLoading,
    auditLoading,
    apps,
    error,
  };
}
