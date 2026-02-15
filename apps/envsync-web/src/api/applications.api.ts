import { useQuery } from "@tanstack/react-query";
import { sdk } from "./base";
import { API_KEYS, App } from "../constants";

const useApplications = ({ refetchInterval = 5 * 60 * 1000 } = {}) => {
  return useQuery({
    queryKey: [API_KEYS.ALL_APPLICATIONS],
    queryFn: async () => {
      const appsData = await sdk.applications.getApps();

      return appsData.map(
        (app): App => ({
          id: app.id,
          org_id: app.org_id,
          name: app.name,
          description: app.description || "",
          created_at: new Date(app.created_at),
          updated_at: new Date(app.updated_at),
          metadata: app.metadata || {},
          status: "active",
          env_count: app.envCount ?? 0,
          secret_count: app.secretCount ?? 0,
          is_managed_secret: app.is_managed_secret ?? false,
          public_key: app.public_key || "",
          enable_secrets: app.enable_secrets ?? false,
        })
      );
    },
    refetchInterval, // Refetch every 5 minutes
    retry: 3,
    initialData: [],
  });
};

export const applications = {
  allApplications: useApplications,
};
