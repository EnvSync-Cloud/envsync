import { useMutation, useQuery } from "@tanstack/react-query";
import { sdk } from "./base";
import {
  CreateRoleRequest,
  RoleResponse,
  UpdateRoleRequest,
} from "@envsync-cloud/envsync-ts-sdk";
import { useInvalidateQueries } from "@/hooks/useApi";
import { getRandomHexCode } from "@/lib/utils";

const getAccessLevel = (
  payload: Pick<RoleResponse, "is_admin" | "can_edit" | "can_view">
) => {
  if (payload.is_admin) return "admin";
  if (payload.can_edit) return "editor";
  if (payload.can_view) return "viewer";
  return "none";
};

const extractFeatures = (
  payload: RoleResponse & {
    have_gpg_access?: boolean;
    have_cert_access?: boolean;
    have_audit_access?: boolean;
  }
) => {
  const features: string[] = [];
  if (payload.have_api_access) features.push("api");
  if (payload.have_billing_options) features.push("billing");
  if (payload.have_webhook_access) features.push("webhook");
  if (payload.have_gpg_access) features.push("gpg");
  if (payload.have_cert_access) features.push("certificates");
  if (payload.have_audit_access) features.push("audit");

  return features;
};

export interface Role {
  id: string;
  name: string;
  color?: string;
  accessLevel: "admin" | "editor" | "viewer" | "none";
  features: string[];
  isMaster: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const useAllRoles = () => {
  return useQuery({
    queryKey: ["roles/all"],
    queryFn: async () => {
      const roles = await sdk.roles.getAllRoles();

      return roles
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((role) => ({
          id: role.id,
          name: role.name,
          color: role.color || getRandomHexCode(),
          accessLevel: getAccessLevel(role),
          features: extractFeatures(role),
          createdAt: new Date(role.created_at),
          updatedAt: new Date(role.updated_at),
          isMaster: role.is_master || false,
        })) satisfies Role[];
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 3,
  });
};

const useCreateRole = () => {
  const { invalidateRoles } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (payload: CreateRoleRequest) => {
      const role = await sdk.roles.createRole(payload);
      return role;
    },
    onSettled: () => {
      invalidateRoles();
    },
  });
};

const useUpdateRole = () => {
  const { invalidateRoles } = useInvalidateQueries();

  return useMutation({
    mutationFn: async ({ role_id, payload }: { role_id: string; payload: UpdateRoleRequest }) => {
      const role = await sdk.roles.updateRole(role_id, {
        ...payload,
      });
      return role;
    },
    onSettled: () => {
      invalidateRoles();
    },
  });
};

const useDeleteRole = () => {
  const { invalidateRoles } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (id: string) => {
      const data = await sdk.roles.deleteRole(id);
      return data;
    },
    onSettled: () => {
      invalidateRoles();
    },
  });
};

export const roles = {
  getAllRoles: useAllRoles,
  createRole: useCreateRole,
  updateRole: useUpdateRole,
  deleteRole: useDeleteRole,
};
