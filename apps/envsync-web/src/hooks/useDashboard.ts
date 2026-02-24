import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { api as Api } from "@/api";

export function useDashboard() {
  const { api } = useAuth();

  const {
    data: apps = [],
    isLoading: appsLoading,
  } = Api.applications.allApplications();

  const {
    data: usersData,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ["dashboard-users"],
    queryFn: async () => {
      const users = await api.users.getUsers();
      return users;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const {
    data: apiKeysData,
    isLoading: apiKeysLoading,
  } = useQuery({
    queryKey: ["dashboard-api-keys"],
    queryFn: async () => {
      const keys = await api.apiKeys.getAllApiKeys();
      return keys;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const {
    data: auditLogs = [],
    isLoading: auditLoading,
  } = useQuery({
    queryKey: ["dashboard-audit"],
    queryFn: async () => {
      const logs = await api.auditLogs.getAuditLogs("1", "20");
      return logs.auditLogs ?? [];
    },
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
  };
}
